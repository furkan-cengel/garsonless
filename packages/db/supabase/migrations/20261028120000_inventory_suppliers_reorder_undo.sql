-- Stock phase 2: suppliers and order units on stock cards, a reorder "sent" mark
-- per supplier, undo of a fresh receipt or waste, and two more overview figures
-- (menu items currently off sale, and the week's food cost against revenue).
--
-- execute_inventory gains two modes:
--   reorder  marks or clears "order sent" for a supplier; nothing moves.
--   reverse  undoes a receipt or waste within 30 minutes, by its author or the
--            owner, by posting opposite movements that point at the originals;
--            a document can be undone once.
-- Item edits keep a stored supplier/order unit when an older client omits them.
-- The function bodies are otherwise those of 20261027130000 and 20261028100000.

alter table public.inventory_items
  add column supplier text not null default '' check (char_length(supplier) <= 80),
  add column order_unit text not null default '' check (char_length(order_unit) <= 40);

create table public.inventory_reorders (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier text not null check (char_length(supplier) between 1 and 80),
  lines jsonb not null default '[]',
  sent_at timestamptz not null,
  sent_by uuid references auth.users(id) on delete set null,
  sent_by_label text not null default 'Personel',
  primary key (restaurant_id, supplier)
);
alter table public.inventory_reorders enable row level security;
revoke all on table public.inventory_reorders from public, anon, authenticated;
grant all on table public.inventory_reorders to service_role;

create or replace function public.inventory_snapshot(p_restaurant uuid,p_offset integer default 0,p_as_of timestamptz default clock_timestamp()) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'asOf',p_as_of,
 'enabled',coalesce((select enabled from public.inventory_settings where restaurant_id=p_restaurant),false),
 'startedAt',(select started_at from public.inventory_settings where restaurant_id=p_restaurant),
 'legacyOpenOrders',(select count(*) from public.orders o where o.restaurant_id=p_restaurant and o.deleted_at is null and o.status::text not in ('served','cancelled') and not exists(select 1 from public.inventory_order_lines l where l.order_id=o.id)),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'unit',unit,'category',category,'shelf',shelf,'threshold',threshold::text,'quantity',quantity::text,'cost',cost::text,'version',version::text,'detailsVersion',details_version::text,'supplier',supplier,'orderUnit',order_unit,'archived',archived,'conversions',conversions) order by category,shelf,name),'[]') from public.inventory_items where restaurant_id=p_restaurant),
 'recipes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'menuItemId',menu_item_id,'outputItemId',output_item_id,'outputQuantity',output_quantity::text,'mode',mode,'version',version,'lines',lines)),'[]') from public.inventory_recipes where restaurant_id=p_restaurant and active),
 'menuItems',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'ingredients',i.ingredients,'modifiers',i.modifier_groups) order by i.name),'[]') from public.menu_items i join public.menu_categories c on c.id=i.category_id where c.restaurant_id=p_restaurant and c.deleted_at is null and i.deleted_at is null),
 'counts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'status',status,'lines',lines,'createdAt',created_at) order by created_at desc),'[]') from (select * from public.inventory_counts where restaurant_id=p_restaurant order by created_at desc limit 100) c),
 'movements',(select coalesce(jsonb_agg(row_to_json(m)),'[]') from (
 select m.id,m.document_id as "documentId",m.item_id as "itemId",i.name,m.quantity::text,m.cost::text,d.kind,d.reason,d.actor_label as actor,m.created_at as "createdAt",d.order_id as "orderId",m.reversal_of as "reversalOf"
 from public.inventory_movements m join public.inventory_documents d on d.id=m.document_id join public.inventory_items i on i.id=m.item_id where m.restaurant_id=p_restaurant and m.created_at<=p_as_of order by m.created_at desc,m.id desc limit 100 offset greatest(p_offset,0)) m),
 'summary',(select coalesce(jsonb_agg(row_to_json(t)),'[]') from (select m.item_id as "itemId",d.kind,sum(m.quantity)::text quantity,case when bool_or(m.cost is null) then null else sum(abs(m.quantity)*m.cost)::text end value from public.inventory_movements m join public.inventory_documents d on d.id=m.document_id where m.restaurant_id=p_restaurant group by m.item_id,d.kind) t),
 'reorders',(select coalesce(jsonb_agg(jsonb_build_object('supplier',supplier,'sentAt',sent_at,'sentBy',sent_by_label)),'[]') from public.inventory_reorders where restaurant_id=p_restaurant),
 'movementOffset',p_offset,'hasMore',(select count(*)>p_offset+100 from public.inventory_movements where restaurant_id=p_restaurant and created_at<=p_as_of),
 'cancelledWaste',(select coalesce(jsonb_agg(row_to_json(w)),'[]') from (
 select l.order_id as "orderId",i.id as "itemId",i.name,sum((r.value::text)::numeric*l.quantity)::text quantity,
 sum(coalesce((l.returned->>i.id::text)::numeric,0))::text returned
 from public.inventory_order_lines l cross join lateral jsonb_each(l.requirements) r join public.inventory_items i on i.id=r.key::uuid
 where l.restaurant_id=p_restaurant and l.consumed and l.prepared and l.cancelled and l.quantity>0 group by l.order_id,i.id,i.name) w)
 );
$$;

create or replace function public.execute_inventory(p_restaurant_id uuid,p_actor_id uuid,p_mode text,p_request_id uuid default null,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 req public.inventory_requests%rowtype; item public.inventory_items%rowtype; rec public.inventory_recipes%rowtype; cnt public.inventory_counts%rowtype;
 line jsonb; lines jsonb; v jsonb; doc uuid; iid uuid; rid uuid; qty numeric; cost numeric; total numeric:=0; missing boolean:=false;
 src public.inventory_documents%rowtype; mv record;
 label text; result jsonb; target uuid; owner_only boolean; k text; c numeric; old_version integer; allocation public.inventory_order_lines%rowtype; available numeric; used numeric; mid uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 owner_only:=p_mode in ('adjustment','count_approve','return','activate','pause','import');
 if not public.inventory_actor(p_restaurant_id,p_actor_id,owner_only) then return jsonb_build_object('ok',false,'error','forbidden'); end if;
 if not public.inventory_allowed(p_restaurant_id) then return jsonb_build_object('ok',false,'error','plan_required'); end if;
 if p_mode='snapshot' then
   result:=public.inventory_snapshot(p_restaurant_id,least(greatest(coalesce((p_payload->>'offset')::integer,0),0),10000000),coalesce((p_payload->>'before')::timestamptz,clock_timestamp()));
   if p_payload->>'documentId' is not null then
     select jsonb_build_object('id',d.id,'kind',d.kind,'reason',d.reason,'actor',d.actor_label,'createdAt',d.created_at,
       'order',(select jsonb_build_object('id',o.id,'status',o.status,'createdAt',o.created_at,'items',o.items) from public.orders o where o.id=d.order_id and o.restaurant_id=p_restaurant_id),
       'lines',(select coalesce(jsonb_agg(jsonb_build_object('name',i.name,'unit',i.unit,'quantity',m.quantity::text,'cost',m.cost::text,'reversalOf',m.reversal_of)),'[]') from public.inventory_movements m join public.inventory_items i on i.id=m.item_id where m.document_id=d.id))
     into v from public.inventory_documents d where d.id=(p_payload->>'documentId')::uuid and d.restaurant_id=p_restaurant_id;
     if not found then raise exception 'not_found'; end if;
     result:=result||jsonb_build_object('document',v);
   end if;
   return jsonb_build_object('ok',true,'data',result);
 end if;
 if p_request_id is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>700000 then raise exception 'invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory:'||p_restaurant_id::text,0));
 if not public.inventory_allowed(p_restaurant_id) then return jsonb_build_object('ok',false,'error','plan_required'); end if;
 select * into req from public.inventory_requests where restaurant_id=p_restaurant_id and request_id=p_request_id;
 if found then
 if req.payload<>jsonb_build_object('mode',p_mode,'payload',p_payload) then raise exception 'request_mismatch'; end if;
 return req.result;
 end if;
 select coalesce(nullif(raw_user_meta_data->>'full_name',''),email,'Personel') into label from auth.users where id=p_actor_id;
 perform id from public.inventory_items where restaurant_id=p_restaurant_id order by id for update;
 if p_mode in ('activate','pause') then
   if p_mode='activate' and coalesce((p_payload->>'confirmed')::boolean,false) is not true then raise exception 'invalid_request'; end if;
   insert into public.inventory_settings(restaurant_id,enabled,started_at) values(p_restaurant_id,p_mode='activate',case when p_mode='activate' then clock_timestamp() else null end)
   on conflict(restaurant_id) do update set enabled=excluded.enabled,started_at=case when excluded.enabled then excluded.started_at else inventory_settings.started_at end,updated_at=clock_timestamp();
 elsif p_mode in ('item','import') then
   lines:=case when p_mode='item' then jsonb_build_array(p_payload) else p_payload->'items' end;
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 500 then raise exception 'invalid_request'; end if;
   for line in select value from jsonb_array_elements(lines) loop
     iid:=coalesce((line->>'id')::uuid,gen_random_uuid());
     select * into item from public.inventory_items where id=iid and restaurant_id=p_restaurant_id;
     if found then
       if p_mode='import' or (case when line ? 'detailsVersion' then item.details_version::text is distinct from line->>'detailsVersion' else item.version::text is distinct from line->>'version' end) then raise exception 'conflict'; end if;
       if item.unit is distinct from line->>'unit' then raise exception 'invalid_request'; end if;
     elsif line ? 'id' then raise exception 'not_found'; end if;
     if coalesce(length(trim(line->>'name')),0) not between 1 and 160 or line->>'kind' not in ('raw','finished','prepared') or line->>'unit' not in ('g','ml','adet') then raise exception 'invalid_request'; end if;
     v:=coalesce(line->'conversions','{}');
     if jsonb_typeof(v)<>'object' then raise exception 'invalid_request'; end if;
     for k in select jsonb_object_keys(v) loop
       if k in ('g','kg','ml','l','adet') or length(k) not between 1 and 40 or public.inventory_decimal(v->>k)<=0 then raise exception 'invalid_request'; end if;
     end loop;
     if coalesce((line->>'archived')::boolean,false) and exists(select 1 from public.inventory_recipes r where r.restaurant_id=p_restaurant_id and r.active and (r.output_item_id=iid or exists(select 1 from jsonb_array_elements(r.lines) x where x->>'itemId'=iid::text))) then raise exception 'conflict'; end if;
     if coalesce(line->>'orderUnit','') not in ('',line->>'unit') and not (line->>'orderUnit'='kg' and line->>'unit'='g') and not (line->>'orderUnit'='l' and line->>'unit'='ml') and not (v ? (line->>'orderUnit')) then raise exception 'invalid_request'; end if;
     insert into public.inventory_items(id,restaurant_id,name,kind,unit,category,shelf,threshold,conversions,archived,supplier,order_unit)
     values(iid,p_restaurant_id,trim(line->>'name'),line->>'kind',line->>'unit',left(coalesce(line->>'category',''),80),left(coalesce(line->>'shelf',''),80),public.inventory_decimal(coalesce(line->>'threshold','0')),v,coalesce((line->>'archived')::boolean,false),left(trim(coalesce(line->>'supplier','')),80),coalesce(line->>'orderUnit',''))
     on conflict(id) do update set name=excluded.name,kind=excluded.kind,category=excluded.category,shelf=excluded.shelf,threshold=excluded.threshold,conversions=excluded.conversions,archived=excluded.archived,
       -- Clients from before supplier existed do not send it; they must not clear it.
       supplier=case when line ? 'supplier' then excluded.supplier else inventory_items.supplier end,
       order_unit=case when line ? 'orderUnit' then excluded.order_unit else inventory_items.order_unit end,version=inventory_items.version+1,details_version=inventory_items.details_version+1;
     if p_mode='import' or item.id is null then
       qty:=public.inventory_decimal(coalesce(line->>'openingQuantity','0'));
       cost:=case when nullif(line->>'openingCost','') is not null then public.inventory_decimal(line->>'openingCost') else null end;
       if qty<>0 or cost is not null then
       insert into public.inventory_documents(restaurant_id,request_id,payload,kind,actor_id,actor_label) values(p_restaurant_id,p_request_id::text||':'||iid,line,'opening',p_actor_id,coalesce(label,'Personel')) returning id into doc;
       perform public.inventory_post(p_restaurant_id,doc,iid,qty,cost);
       end if;
     end if;
     item:=null;
   end loop;
 elsif p_mode='recipe' then
   target:=coalesce((p_payload->>'menuItemId')::uuid,(p_payload->>'outputItemId')::uuid);
   if target is null or num_nonnulls(p_payload->>'menuItemId',p_payload->>'outputItemId')<>1 then raise exception 'invalid_request'; end if;
   if p_payload->>'menuItemId' is not null then
     if not exists(select 1 from public.menu_items i join public.menu_categories c on c.id=i.category_id where i.id=target and c.restaurant_id=p_restaurant_id and i.deleted_at is null and c.deleted_at is null) then raise exception 'not_found'; end if;
   else
     if not exists(select 1 from public.inventory_items where id=target and restaurant_id=p_restaurant_id and not archived and kind in ('prepared','finished')) then raise exception 'not_found'; end if;
   end if;
   select * into rec from public.inventory_recipes where restaurant_id=p_restaurant_id and active and (menu_item_id=(p_payload->>'menuItemId')::uuid or output_item_id=(p_payload->>'outputItemId')::uuid);
   old_version:=coalesce(rec.version,0);
   if old_version<>coalesce((p_payload->>'version')::integer,0) then raise exception 'conflict'; end if;
   lines:=p_payload->'lines';
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines)>100 or p_payload->>'mode' not in ('none','direct','recipe') then raise exception 'invalid_request'; end if;
   if p_payload->>'mode'<>'none' and jsonb_array_length(lines)=0 then raise exception 'invalid_request'; end if;
   if p_payload->>'mode'='none' and jsonb_array_length(lines)<>0 then raise exception 'invalid_request'; end if;
   if p_payload->>'mode'='direct' and (select count(*) from jsonb_array_elements(lines) x where nullif(x->>'optionId','') is null)<>1 then raise exception 'invalid_request'; end if;
   for line in select value from jsonb_array_elements(lines) loop
     iid:=(line->>'itemId')::uuid;
     if not exists(select 1 from public.inventory_items where id=iid and restaurant_id=p_restaurant_id and not archived) or public.inventory_decimal(line->>'quantity')<=0 then raise exception 'invalid_request'; end if;
     if p_payload->>'outputItemId' is not null and (iid=target or nullif(line->>'optionId','') is not null or nullif(line->>'ingredientId','') is not null) then raise exception 'recipe_cycle'; end if;
     if nullif(line->>'ingredientId','') is not null and not exists(select 1 from public.menu_items i cross join lateral jsonb_array_elements(i.ingredients) x where i.id=target and x->>'id'=line->>'ingredientId' and (x->>'removable')::boolean) then raise exception 'invalid_request'; end if;
     if nullif(line->>'optionId','') is not null and not exists(select 1 from public.menu_items i cross join lateral jsonb_array_elements(i.modifier_groups) g cross join lateral jsonb_array_elements(g->'options') o where i.id=target and g->>'id'=line->>'groupId' and o->>'id'=line->>'optionId') then raise exception 'invalid_request'; end if;
     if nullif(line->>'replacesItemId','') is not null and (nullif(line->>'optionId','') is null or not exists(select 1 from jsonb_array_elements(lines) x where x->>'itemId'=line->>'replacesItemId' and nullif(x->>'optionId','') is null)) then raise exception 'invalid_request'; end if;
   end loop;
   if p_payload->>'outputItemId' is not null and exists(
     with recursive edges as (select r.output_item_id src,(x->>'itemId')::uuid dst from public.inventory_recipes r cross join lateral jsonb_array_elements(r.lines) x where r.restaurant_id=p_restaurant_id and r.active and r.output_item_id is not null and r.output_item_id<>target
     union all select target,(x->>'itemId')::uuid from jsonb_array_elements(lines) x), walk(node,path,cycle) as (
     select target,array[target],false union all select e.dst,w.path||e.dst,e.dst=any(w.path) from walk w join edges e on e.src=w.node where not w.cycle)
     select 1 from walk where cycle) then raise exception 'recipe_cycle'; end if;
   update public.inventory_recipes set active=false where id=rec.id;
   insert into public.inventory_recipes(restaurant_id,menu_item_id,output_item_id,output_quantity,mode,version,lines)
   values(p_restaurant_id,(p_payload->>'menuItemId')::uuid,(p_payload->>'outputItemId')::uuid,public.inventory_decimal(coalesce(p_payload->>'outputQuantity','1')),p_payload->>'mode',old_version+1,lines) returning id into rid;
 elsif p_mode='count_save' then
   iid:=coalesce((p_payload->>'id')::uuid,gen_random_uuid()); lines:=p_payload->'lines';
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 2000 or (select count(distinct x->>'itemId') from jsonb_array_elements(lines) x)<>jsonb_array_length(lines) then raise exception 'invalid_request'; end if;
   select * into cnt from public.inventory_counts where id=iid and restaurant_id=p_restaurant_id;
   if found and (cnt.status<>'draft' or cnt.version<>coalesce((p_payload->>'version')::integer,0)) then raise exception 'conflict'; end if;
   if not found and p_payload ? 'id' then raise exception 'not_found'; end if;
   for line in select value from jsonb_array_elements(lines) loop
     if not exists(select 1 from public.inventory_items where id=(line->>'itemId')::uuid and restaurant_id=p_restaurant_id) then raise exception 'not_found'; end if;
     if line->>'quantity' is not null then perform public.inventory_decimal(line->>'quantity'); end if;
     if line->>'version' !~ '^[0-9]+$' then raise exception 'invalid_request'; end if;
   end loop;
   insert into public.inventory_counts(id,restaurant_id,lines) values(iid,p_restaurant_id,lines) on conflict(id) do update set lines=excluded.lines,version=inventory_counts.version+1;
 elsif p_mode='reorder' then
   -- Marks a supplier's order as sent (or clears the mark). No stock moves.
   if coalesce(length(trim(p_payload->>'supplier')),0) not between 1 and 80 then raise exception 'invalid_request'; end if;
   if coalesce((p_payload->>'sent')::boolean,false) then
     insert into public.inventory_reorders(restaurant_id,supplier,lines,sent_at,sent_by,sent_by_label)
     values(p_restaurant_id,trim(p_payload->>'supplier'),coalesce(p_payload->'lines','[]'),clock_timestamp(),p_actor_id,coalesce(label,'Personel'))
     on conflict(restaurant_id,supplier) do update set lines=excluded.lines,sent_at=excluded.sent_at,sent_by=excluded.sent_by,sent_by_label=excluded.sent_by_label;
   else
     delete from public.inventory_reorders where restaurant_id=p_restaurant_id and supplier=trim(p_payload->>'supplier');
   end if;
 elsif p_mode='reverse' then
   -- Undo of a fresh receipt or waste: opposite movements that point at the originals.
   select * into src from public.inventory_documents where id=(p_payload->>'documentId')::uuid and restaurant_id=p_restaurant_id for update;
   if not found then raise exception 'not_found'; end if;
   if src.kind not in ('receipt','waste') then raise exception 'invalid_request'; end if;
   if src.actor_id is distinct from p_actor_id and not public.inventory_actor(p_restaurant_id,p_actor_id,true) then raise exception 'forbidden'; end if;
   if src.created_at<clock_timestamp()-interval '30 minutes' then raise exception 'conflict'; end if;
   if exists(select 1 from public.inventory_movements r join public.inventory_movements o on o.id=r.reversal_of where o.document_id=src.id) then raise exception 'conflict'; end if;
   insert into public.inventory_documents(restaurant_id,request_id,payload,kind,reason,actor_id,actor_label)
   values(p_restaurant_id,p_request_id::text,p_payload,'reversal',left('Geri alındı: '||case src.kind when 'receipt' then 'mal kabul' else 'fire' end||coalesce(nullif(' · '||src.reason,' · '),''),500),p_actor_id,coalesce(label,'Personel')) returning id into doc;
   for mv in select m.id,m.item_id,m.quantity from public.inventory_movements m where m.document_id=src.id order by m.item_id loop
     perform public.inventory_post(p_restaurant_id,doc,mv.item_id,-mv.quantity,null,mv.id);
   end loop;
 elsif p_mode in ('receipt','waste','adjustment','external_sale','production','count_approve','return') then
   if p_mode in ('waste','adjustment','external_sale','return') and coalesce(length(trim(p_payload->>'reason')),0)<3 then raise exception 'invalid_request'; end if;
   insert into public.inventory_documents(restaurant_id,request_id,payload,kind,reason,actor_id,actor_label,order_id)
   values(p_restaurant_id,p_request_id::text,p_payload,p_mode,left(coalesce(p_payload->>'reason',''),500),p_actor_id,coalesce(label,'Personel'),case when p_mode='return' then (p_payload->>'orderId')::uuid end) returning id into doc;
   if p_mode='count_approve' then
     select * into cnt from public.inventory_counts where id=(p_payload->>'id')::uuid and restaurant_id=p_restaurant_id for update;
     if not found then raise exception 'not_found'; end if;
     if cnt.status<>'draft' or cnt.version<>(p_payload->>'version')::integer then raise exception 'conflict'; end if;
     lines:=cnt.lines;
   else lines:=p_payload->'lines'; end if;
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 2000 or (select count(distinct x->>'itemId') from jsonb_array_elements(lines) x)<>jsonb_array_length(lines) then raise exception 'invalid_request'; end if;
   if p_mode='production' then
     select * into rec from public.inventory_recipes where id=(p_payload->>'recipeId')::uuid and restaurant_id=p_restaurant_id and output_item_id is not null and active;
     if not found then raise exception 'not_found'; end if;
     if public.inventory_decimal(p_payload->>'outputQuantity')<=0 then raise exception 'invalid_request'; end if;
   end if;
   for line in select value from jsonb_array_elements(lines) order by value->>'itemId' loop
     iid:=(line->>'itemId')::uuid;
     select * into item from public.inventory_items where id=iid and restaurant_id=p_restaurant_id for update;
     if not found or (item.archived and p_mode not in ('return','count_approve','adjustment')) then raise exception 'not_found'; end if;
     if p_mode='count_approve' and line->>'quantity' is null then continue; end if;
     qty:=public.inventory_decimal(line->>'quantity',p_mode='adjustment');
     if p_mode not in ('adjustment','count_approve') and qty<=0 then raise exception 'invalid_request'; end if;
     cost:=case when nullif(line->>'cost','') is not null then public.inventory_decimal(line->>'cost') else null end;
     if p_mode='count_approve' then
       if item.version::text is distinct from line->>'version' then raise exception 'conflict'; end if;
       qty:=qty-item.quantity; cost:=item.cost;
     elsif p_mode='production' then
       if not exists(select 1 from jsonb_array_elements(rec.lines) x where x->>'itemId'=iid::text) then raise exception 'invalid_request'; end if;
       total:=total+qty*coalesce(item.cost,0); missing:=missing or item.cost is null;
       qty:=-qty;
     elsif p_mode in ('waste','external_sale') then qty:=-qty;
     elsif p_mode='return' then
       available:=qty;
       for allocation in select * from public.inventory_order_lines where restaurant_id=p_restaurant_id and order_id=(p_payload->>'orderId')::uuid and consumed and prepared and cancelled and requirements ? iid::text order by line_id for update loop
         used:=least(available,greatest(0,(allocation.requirements->>iid::text)::numeric*allocation.quantity-coalesce((allocation.returned->>iid::text)::numeric,0)));
         if used>0 then
           select m.id into mid from public.inventory_movements m join public.inventory_documents d on d.id=m.document_id where m.restaurant_id=p_restaurant_id and m.item_id=iid and d.kind='sale' and d.payload->>'lineId'=allocation.line_id::text order by m.created_at limit 1;
           perform public.inventory_post(p_restaurant_id,doc,iid,used,(allocation.costs->>iid::text)::numeric,mid);
           update public.inventory_order_lines set returned=jsonb_set(returned,array[iid::text],to_jsonb(coalesce((returned->>iid::text)::numeric,0)+used)) where order_id=allocation.order_id and line_id=allocation.line_id;
           available:=available-used;
         end if;
       end loop;
       if available>0 then raise exception 'invalid_request'; end if;
       continue;
     end if;
     perform public.inventory_post(p_restaurant_id,doc,iid,qty,cost);
   end loop;
   if p_mode='production' then
     if exists(select 1 from jsonb_array_elements(rec.lines) x where not exists(select 1 from jsonb_array_elements(lines) y where y->>'itemId'=x->>'itemId')) then raise exception 'invalid_request'; end if;
     qty:=public.inventory_decimal(p_payload->>'outputQuantity');
     perform public.inventory_post(p_restaurant_id,doc,rec.output_item_id,qty,case when missing then null else round(total/qty,6) end);
   elsif p_mode='count_approve' then update public.inventory_counts set status='approved',version=version+1,document_id=doc where id=cnt.id;
   end if;
 else raise exception 'invalid_request'; end if;
 with affected as (
   select i.* from public.inventory_items i where i.restaurant_id=p_restaurant_id and (
     (p_mode='item' and i.id=iid) or exists(select 1 from public.inventory_movements m join public.inventory_documents d on d.id=m.document_id where m.item_id=i.id and d.restaurant_id=p_restaurant_id and (d.request_id=p_request_id::text or d.request_id like p_request_id::text||':%')))
 ), warnings as (
   select a.id,case when a.quantity<0 then 'negative_stock' else 'critical_stock' end code from affected a where a.quantity<=a.threshold
   union all select a.id,'missing_cost' from affected a where a.cost is null
 )
 select jsonb_build_object('ok',true,'data',jsonb_build_object('documentId',doc,'id',coalesce(rid,iid),
   'balances',(select coalesce(jsonb_agg(jsonb_build_object('itemId',a.id,'quantity',a.quantity::text,'cost',a.cost::text,'version',a.version::text)),'[]') from affected a),
   'warnings',(select coalesce(jsonb_agg(jsonb_build_object('itemId',id,'code',code)),'[]') from warnings))) into result;
 insert into public.inventory_requests values(p_restaurant_id,p_request_id,jsonb_build_object('mode',p_mode,'payload',p_payload),result);
 return result;
exception when others then
 if sqlerrm in ('forbidden','plan_required','invalid_request','not_found','conflict','request_mismatch','recipe_cycle') then return jsonb_build_object('ok',false,'error',sqlerrm); end if;
 if sqlstate in ('22P02','23514','23502','22003','22023') then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
 raise;
end $$;

create or replace function public.inventory_insights(p_restaurant uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tz as (
    select coalesce(nullif(r.timezone, ''), 'Europe/Istanbul') as zone
    from public.restaurants r
    where r.id = p_restaurant
  ),
  today as (
    select (clock_timestamp() at time zone tz.zone)::date as day, tz.zone from tz
  ),
  moves as (
    select m.item_id, m.quantity, m.cost, m.created_at, d.kind, d.reason, d.actor_label,
      (m.created_at at time zone t.zone)::date as day
    from public.inventory_movements m
    join public.inventory_documents d on d.id = m.document_id
    cross join today t
    where m.restaurant_id = p_restaurant
      and m.created_at >= clock_timestamp() - interval '15 days'
  ),
  consumption as (
    select mv.item_id, mv.day, sum(-mv.quantity) as used
    from moves mv
    where mv.kind in ('sale', 'external_sale', 'cancellation_return')
       or (mv.kind = 'production' and mv.quantity < 0)
    group by mv.item_id, mv.day
  ),
  receipts as (
    select m.item_id, m.created_at, m.quantity, m.cost,
      row_number() over (partition by m.item_id order by m.created_at desc, m.id desc) as rn
    from public.inventory_movements m
    join public.inventory_documents d on d.id = m.document_id
    where m.restaurant_id = p_restaurant and d.kind = 'receipt' and m.quantity > 0
  ),
  recent as (
    select m.item_id, m.created_at, m.quantity, d.kind, d.reason, d.actor_label,
      row_number() over (partition by m.item_id order by m.created_at desc, m.id desc) as rn
    from public.inventory_movements m
    join public.inventory_documents d on d.id = m.document_id
    where m.restaurant_id = p_restaurant
  )
  select jsonb_build_object(
    'today', (select day from today),
    'lastSaleAt', (
      select max(m.created_at) from public.inventory_movements m
      join public.inventory_documents d on d.id = m.document_id
      where m.restaurant_id = p_restaurant and d.kind = 'sale'
    ),
    'unavailableMenuItems', (
      select coalesce(jsonb_agg(i.id), '[]') from public.menu_items i join public.menu_categories c on c.id = i.category_id
      where c.restaurant_id = p_restaurant and c.deleted_at is null and i.deleted_at is null and not i.is_available
    ),
    -- Food cost: what sales took out of stock, against collected revenue, over the last 7 days.
    'foodCost', jsonb_build_object(
      'consumption', (select coalesce(sum(-mv.quantity * mv.cost), 0)::text from moves mv where mv.kind in ('sale', 'cancellation_return') and mv.created_at >= clock_timestamp() - interval '7 days'),
      'missingCost', (select coalesce(bool_or(mv.cost is null), false) from moves mv where mv.kind = 'sale' and mv.created_at >= clock_timestamp() - interval '7 days'),
      'revenue', (select coalesce(sum(o.total), 0)::text from public.orders o where o.restaurant_id = p_restaurant and o.paid_at >= clock_timestamp() - interval '7 days' and o.status::text <> 'cancelled' and o.payment_method is distinct from 'comp')
    ),
    'waste', jsonb_build_object(
      'thisWeek', (select coalesce(sum(abs(mv.quantity) * mv.cost), 0)::text from moves mv where mv.kind = 'waste' and mv.created_at >= clock_timestamp() - interval '7 days'),
      'lastWeek', (select coalesce(sum(abs(mv.quantity) * mv.cost), 0)::text from moves mv where mv.kind = 'waste' and mv.created_at >= clock_timestamp() - interval '14 days' and mv.created_at < clock_timestamp() - interval '7 days'),
      'missingCost', (select coalesce(bool_or(mv.cost is null), false) from moves mv where mv.kind = 'waste' and mv.created_at >= clock_timestamp() - interval '7 days')
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'itemId', i.id,
        'daily', (
          select jsonb_agg(coalesce(c.used, 0)::text order by g.day)
          from today t
          cross join lateral generate_series(t.day - 6, t.day, interval '1 day') as g(day)
          left join consumption c on c.item_id = i.id and c.day = g.day::date
        ),
        'lastReceipt', (
          select jsonb_build_object('at', r.created_at, 'quantity', r.quantity::text, 'cost', r.cost::text)
          from receipts r where r.item_id = i.id and r.rn = 1
        ),
        'previousReceiptCost', (select r.cost::text from receipts r where r.item_id = i.id and r.rn = 2),
        'recent', (
          select coalesce(jsonb_agg(jsonb_build_object('at', x.created_at, 'kind', x.kind, 'quantity', x.quantity::text, 'reason', x.reason, 'actor', x.actor_label) order by x.created_at desc), '[]')
          from recent x where x.item_id = i.id and x.rn <= 5
        )
      )), '[]')
      from public.inventory_items i
      where i.restaurant_id = p_restaurant and not i.archived
    )
  );
$$;
