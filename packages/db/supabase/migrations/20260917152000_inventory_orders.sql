create function public.inventory_order_identity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if coalesce(current_setting('masabu.inventory_transfer',true),'')='on' then return new; end if;
 new.items:=(select coalesce(jsonb_agg(x||jsonb_build_object('inventoryLineId',gen_random_uuid())),'[]') from jsonb_array_elements(new.items) x);
 return new;
end $$;
create trigger inventory_order_identity before insert on public.orders for each row execute function public.inventory_order_identity();

create function public.inventory_order_lifecycle() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.inventory_settings%rowtype; rec public.inventory_recipes%rowtype; allocation public.inventory_order_lines%rowtype;
 line jsonb; ingredient jsonb; modifier jsonb; requirements jsonb; prices jsonb; qty numeric; factor numeric; iid text; doc uuid; reversal uuid; v_active boolean;
begin
 if coalesce(current_setting('masabu.inventory_transfer',true),'')='on' then return new; end if;
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
 if not exists(select 1 from public.inventory_settings where restaurant_id=new.restaurant_id) then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory:'||new.restaurant_id::text,0));
 select * into s from public.inventory_settings where restaurant_id=new.restaurant_id;
 v_active:=s.enabled and public.inventory_allowed(new.restaurant_id);
 if tg_op='INSERT' then
   if not v_active or new.created_at<s.started_at then return new; end if;
   for line in select value from jsonb_array_elements(new.items) loop
     select * into rec from public.inventory_recipes where restaurant_id=new.restaurant_id and menu_item_id=(line->>'itemId')::uuid and active=true;
     requirements:='{}';
     if found and rec.mode<>'none' then
       for ingredient in select value from jsonb_array_elements(rec.lines) loop
         factor:=1;
         if nullif(ingredient->>'optionId','') is not null then
           select value into modifier from jsonb_array_elements(coalesce(line->'modifiers','[]')) where value->>'groupId'=ingredient->>'groupId' and value->>'optionId'=ingredient->>'optionId';
           if not found then continue; end if;
           factor:=coalesce((modifier->>'quantity')::numeric,1);
         else
           if nullif(ingredient->>'ingredientId','') is not null and exists(select 1 from jsonb_array_elements(coalesce(line->'removedIngredients','[]')) x where x->>'id'=ingredient->>'ingredientId') then continue; end if;
           if exists(select 1 from jsonb_array_elements(rec.lines) x join lateral jsonb_array_elements(coalesce(line->'modifiers','[]')) m on m->>'groupId'=x->>'groupId' and m->>'optionId'=x->>'optionId' where x->>'replacesItemId'=ingredient->>'itemId') then continue; end if;
         end if;
         iid:=ingredient->>'itemId'; qty:=(ingredient->>'quantity')::numeric*factor;
         requirements:=jsonb_set(requirements,array[iid],to_jsonb(coalesce((requirements->>iid)::numeric,0)+qty));
       end loop;
     end if;
     insert into public.inventory_order_lines(restaurant_id,order_id,line_id,quantity,recipe_id,requirements)
     values(new.restaurant_id,new.id,(line->>'inventoryLineId')::uuid,(line->>'quantity')::numeric,rec.id,requirements);
   end loop;
 end if;
 perform id from public.inventory_items where restaurant_id=new.restaurant_id order by id for update;
 for allocation in select * from public.inventory_order_lines where order_id=new.id order by line_id for update loop
   if v_active and new.created_at>=s.started_at and new.status::text in ('sent_to_kitchen','preparing','ready','served') and not allocation.consumed and not allocation.cancelled then
     insert into public.inventory_documents(restaurant_id,request_id,payload,kind,order_id)
     values(new.restaurant_id,'sale:'||new.id||':'||allocation.line_id,jsonb_build_object('lineId',allocation.line_id),'sale',new.id) returning id into doc;
     prices:='{}';
     for iid in select jsonb_object_keys(allocation.requirements) order by 1 loop
       qty:=(allocation.requirements->>iid)::numeric*allocation.quantity;
       prices:=jsonb_set(prices,array[iid],coalesce((select to_jsonb(cost) from public.inventory_items where id=iid::uuid),'null'));
       perform public.inventory_post(new.restaurant_id,doc,iid::uuid,-qty);
     end loop;
     update public.inventory_order_lines set consumed=true,costs=prices where order_id=new.id and line_id=allocation.line_id;
     allocation.consumed:=true; allocation.costs:=prices;
   end if;
   if new.status::text in ('preparing','ready','served') then
     update public.inventory_order_lines set prepared=true where order_id=new.id and line_id=allocation.line_id;
     allocation.prepared:=true;
   end if;
   if new.status::text='cancelled' and not allocation.cancelled then
     if allocation.consumed and not allocation.prepared and allocation.quantity>0 then
       insert into public.inventory_documents(restaurant_id,request_id,payload,kind,reason,order_id,actor_id)
       values(new.restaurant_id,'cancel:'||new.id||':'||allocation.line_id,jsonb_build_object('lineId',allocation.line_id),'cancellation_return',coalesce(new.cancel_reason,''),new.id,new.cancelled_by) returning id into doc;
       for iid in select jsonb_object_keys(allocation.requirements) order by 1 loop
         select m.id into reversal from public.inventory_movements m join public.inventory_documents d on d.id=m.document_id where m.restaurant_id=new.restaurant_id and m.item_id=iid::uuid and d.kind='sale' and d.payload->>'lineId'=allocation.line_id::text order by m.created_at limit 1;
         qty:=(allocation.requirements->>iid)::numeric*allocation.quantity;
         perform public.inventory_post(new.restaurant_id,doc,iid::uuid,qty,(allocation.costs->>iid)::numeric,reversal);
       end loop;
     end if;
     update public.inventory_order_lines set cancelled=true where order_id=new.id and line_id=allocation.line_id;
   end if;
 end loop;
 return new;
end $$;
create trigger inventory_order_lifecycle after insert or update of status on public.orders for each row execute function public.inventory_order_lifecycle();

-- Wrap the latest existing transfer implementations; preserve all financial guards.
alter function public.transfer_table_order_items(uuid,uuid,uuid,jsonb,uuid,uuid) rename to transfer_table_order_items_before_inventory;
alter function public.undo_table_transfer(uuid,uuid,uuid) rename to undo_table_transfer_before_inventory;
create function public.inventory_sync_transfer(p_restaurant uuid,p_operation uuid,p_undo boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare split record; line jsonb; source public.inventory_order_lines%rowtype; n numeric;
begin
 for split in select x.* from public.table_transfer_item_splits x join public.table_transfer_operations o on o.id=x.operation_id where x.operation_id=p_operation and o.restaurant_id=p_restaurant loop
   if p_undo and exists(select 1 from public.inventory_order_lines a join public.inventory_order_lines b on b.line_id=a.line_id where a.order_id=split.source_order_id and b.order_id=split.target_order_id and (a.consumed is distinct from b.consumed or a.prepared is distinct from b.prepared or a.cancelled is distinct from b.cancelled or a.costs is distinct from b.costs)) then
     raise exception 'Hazırlık veya tüketim durumu değişen ürün taşıması geri alınamaz';
   end if;
   if not p_undo then
     for line in select value from public.orders o cross join lateral jsonb_array_elements(o.items) where o.id=split.target_order_id loop
       select * into source from public.inventory_order_lines where order_id=split.source_order_id and line_id=(line->>'inventoryLineId')::uuid;
       if not found then continue; end if;
       n:=(line->>'quantity')::numeric;
       -- Transfers are forbidden by the core while cancellation/financial changes race.
       insert into public.inventory_order_lines(restaurant_id,order_id,line_id,quantity,recipe_id,requirements,consumed,prepared,cancelled,returned,costs)
       values(p_restaurant,split.target_order_id,source.line_id,n,source.recipe_id,source.requirements,source.consumed,source.prepared,source.cancelled,
       (select coalesce(jsonb_object_agg(key,to_jsonb(value::numeric*n/nullif(source.quantity,0))),'{}') from jsonb_each_text(source.returned)),source.costs)
       on conflict(order_id,line_id) do nothing;
     end loop;
   end if;
   for source in select * from public.inventory_order_lines where order_id=split.source_order_id loop
     select (value->>'quantity')::numeric into n from public.orders o cross join lateral jsonb_array_elements(o.items) where o.id=split.source_order_id and value->>'inventoryLineId'=source.line_id::text;
     update public.inventory_order_lines set quantity=coalesce(n,0) where order_id=source.order_id and line_id=source.line_id;
   end loop;
   if p_undo then update public.inventory_order_lines set quantity=0 where order_id=split.target_order_id; end if;
 end loop;
end $$;
create function public.transfer_table_order_items(p_restaurant_id uuid,p_source_table_id uuid,p_target_table_id uuid,p_selections jsonb,p_actor_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; previous text;
begin
 previous:=coalesce(current_setting('masabu.inventory_transfer',true),'');
 perform set_config('masabu.inventory_transfer','on',true);
 result:=public.transfer_table_order_items_before_inventory(p_restaurant_id,p_source_table_id,p_target_table_id,p_selections,p_actor_id,p_request_id);
 perform pg_advisory_xact_lock(hashtextextended('inventory:'||p_restaurant_id::text,0));
 if not (result ? 'error') and not coalesce((result->>'idempotent')::boolean,false) then perform public.inventory_sync_transfer(p_restaurant_id,(result->>'operationId')::uuid,false); end if;
 perform set_config('masabu.inventory_transfer',previous,true);
 return result;
end $$;
create function public.undo_table_transfer(p_restaurant_id uuid,p_operation_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; previous text;
begin
 previous:=coalesce(current_setting('masabu.inventory_transfer',true),'');
 perform set_config('masabu.inventory_transfer','on',true);
 result:=public.undo_table_transfer_before_inventory(p_restaurant_id,p_operation_id,p_actor_id);
 perform pg_advisory_xact_lock(hashtextextended('inventory:'||p_restaurant_id::text,0));
 if not (result ? 'error') and not coalesce((result->>'idempotent')::boolean,false) then perform public.inventory_sync_transfer(p_restaurant_id,p_operation_id,true); end if;
 perform set_config('masabu.inventory_transfer',previous,true);
 return result;
end $$;

create function public.inventory_access_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
 if tg_table_name='restaurants' then rid:=new.id; else rid:=new.restaurant_id; end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory:'||rid::text,0));
 if tg_table_name='billing_subscriptions' and tg_op='UPDATE' then
   if old.status='trial' and old.trial_ends_at<=clock_timestamp() then update public.inventory_settings set enabled=false,updated_at=clock_timestamp() where restaurant_id=rid and enabled; end if;
 end if;
 if not public.inventory_allowed(rid) then update public.inventory_settings set enabled=false,updated_at=clock_timestamp() where restaurant_id=rid and enabled; end if;
 return new;
end $$;
create trigger inventory_subscription_access after insert or update of status,trial_ends_at on public.billing_subscriptions for each row execute function public.inventory_access_changed();
create trigger inventory_plan_access after update of plan on public.restaurants for each row execute function public.inventory_access_changed();

-- Default function EXECUTE is public in PostgreSQL: close every new entrypoint.
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'inventory_%' or proname in ('execute_inventory','transfer_table_order_items_before_inventory','undo_table_transfer_before_inventory','transfer_table_order_items','undo_table_transfer')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
grant execute on function public.inventory_allowed(uuid) to authenticated;
