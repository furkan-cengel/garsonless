-- Independent, tenant-bound menu operations. No order snapshots are modified.
create table public.menu_bulk_operations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_id uuid not null,
  actor_label text not null,
  request_id uuid not null,
  request_payload jsonb not null,
  changes jsonb not null,
  undo_of uuid references public.menu_bulk_operations(id),
  created_at timestamptz not null default clock_timestamp(),
  unique (restaurant_id, request_id),
  unique (undo_of)
);
create index menu_bulk_operations_history on public.menu_bulk_operations(restaurant_id, created_at desc, id);
alter table public.menu_bulk_operations enable row level security;
revoke all on public.menu_bulk_operations from public, anon, authenticated;
grant select, insert, delete on public.menu_bulk_operations to service_role;

-- The trusted server supplies the authenticated actor, never a browser actor id.
create function public.execute_menu_bulk(
  p_restaurant_id uuid, p_actor_id uuid, p_mode text,
  p_request_id uuid default null, p_operation_id uuid default null,
  p_patches jsonb default '[]', p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_existing public.menu_bulk_operations%rowtype;
  v_source public.menu_bulk_operations%rowtype;
  v_operation public.menu_bulk_operations%rowtype;
  v_item public.menu_items%rowtype;
  v_patch jsonb; v_values jsonb; v_before jsonb; v_after jsonb; v_field text;
  v_changes jsonb := '[]'; v_patches jsonb := p_patches;
  v_conflicts jsonb := '[]'; v_payload jsonb;
  v_label text; v_history jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id and r.deleted_at is null and (
    r.owner_id = p_actor_id or exists (
      select 1 from public.restaurant_members m where m.restaurant_id = r.id
      and m.user_id = p_actor_id and m.status = 'active' and m.permissions ? 'menu'
    ) or exists (
      select 1 from public.organization_restaurants link
      join public.organizations o on o.id = link.organization_id and o.status = 'active'
      join public.organization_members m on m.organization_id = o.id and m.status = 'active'
      where link.restaurant_id = r.id and m.user_id = p_actor_id
        and (m.role in ('owner', 'admin') or m.permissions ? 'menu')
    )
  )) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_mode not in ('preview','apply','undo','history','detail','snapshot') then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  if p_mode = 'snapshot' then
    if jsonb_typeof(p_patches) is distinct from 'array' or jsonb_array_length(p_patches) not between 1 and 500 then
      return jsonb_build_object('ok',false,'error','invalid_request');
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'description',i.description,'price',i.price,
      'category_id',i.category_id,'is_available',i.is_available,'updated_at',i.updated_at)), '[]') into v_history
      from public.menu_items i join public.menu_categories c on c.id = i.category_id
      where c.restaurant_id = p_restaurant_id and c.deleted_at is null and i.deleted_at is null
        and i.id in (select (p->>'id')::uuid from jsonb_array_elements(p_patches) p);
    return jsonb_build_object('ok',true,'changes','[]'::jsonb,'items',v_history);
  end if;
  if p_mode = 'history' then
    select coalesce(jsonb_agg(to_jsonb(h)), '[]') into v_history from (
      select o.id, o.actor_id, o.actor_label, o.created_at, o.undo_of,
        (select u.id from public.menu_bulk_operations u where u.undo_of = o.id) as undone_by,
        jsonb_array_length(o.changes) as count
      from public.menu_bulk_operations o where o.restaurant_id = p_restaurant_id
      order by o.created_at desc, o.id desc limit 20 offset greatest(0, least(coalesce(p_offset,0),100000))
    ) h;
    return jsonb_build_object('ok',true,'changes','[]'::jsonb,'history',v_history);
  end if;
  if p_mode in ('detail','undo') then
    select * into v_source from public.menu_bulk_operations where id = p_operation_id and restaurant_id = p_restaurant_id;
    if not found then return jsonb_build_object('ok',false,'error','not_found'); end if;
    if p_mode = 'detail' then return jsonb_build_object('ok',true,'changes',v_source.changes); end if;
  end if;
  if p_mode in ('apply','undo') then
    if p_request_id is null then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
    -- Serialize duplicate requests and undo requests before checking durable results.
    perform pg_advisory_xact_lock(hashtextextended('menu-bulk:' || p_restaurant_id::text,0));
    v_payload := jsonb_build_object('mode',p_mode,'patches',p_patches,'operationId',p_operation_id);
    select * into v_existing from public.menu_bulk_operations where restaurant_id = p_restaurant_id and request_id = p_request_id;
    if found then
      if v_existing.request_payload <> v_payload then return jsonb_build_object('ok',false,'error','request_mismatch'); end if;
      return jsonb_build_object('ok',true,'changes',v_existing.changes,'operation',
        (to_jsonb(v_existing) - 'changes' - 'request_payload' - 'request_id' - 'restaurant_id') || jsonb_build_object('count',jsonb_array_length(v_existing.changes),'undone_by',null));
    end if;
  end if;
  if p_mode = 'undo' then
    select * into v_existing from public.menu_bulk_operations where undo_of = p_operation_id;
    if found then return jsonb_build_object('ok',true,'changes',v_existing.changes); end if;
    if v_source.undo_of is not null then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
    select jsonb_agg(jsonb_build_object('id',c->>'id','expectedUpdatedAt',c->>'afterVersion','changes',c->'before'))
      into v_patches from jsonb_array_elements(v_source.changes) c;
  end if;
  if jsonb_typeof(v_patches) is distinct from 'array' or jsonb_array_length(v_patches) not between 1 and 500
    or octet_length(v_patches::text) > 700000 then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if (select count(distinct p->>'id') from jsonb_array_elements(v_patches) p) <> jsonb_array_length(v_patches) then
    return jsonb_build_object('ok',false,'error','invalid_request');
  end if;

  -- Category locks prevent deletion/moves while validating and writing products.
  perform c.id from public.menu_categories c where c.restaurant_id = p_restaurant_id
    order by c.id for share;
  perform i.id from public.menu_items i join public.menu_categories c on c.id = i.category_id
    where c.restaurant_id = p_restaurant_id and i.id in (select (p->>'id')::uuid from jsonb_array_elements(v_patches) p)
    order by i.id for update of i;

  for v_patch in select value from jsonb_array_elements(v_patches) loop
    v_values := v_patch->'changes';
    if jsonb_typeof(v_values) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(v_patch) k where k not in ('id','expectedUpdatedAt','changes'))
      or exists(select 1 from jsonb_object_keys(v_values) k where k not in ('name','description','price','category_id','is_available')) then
      return jsonb_build_object('ok',false,'error','invalid_request');
    end if;
    select i.* into v_item from public.menu_items i join public.menu_categories c on c.id = i.category_id
      where i.id = (v_patch->>'id')::uuid and c.restaurant_id = p_restaurant_id and c.deleted_at is null and i.deleted_at is null;
    if not found or v_item.updated_at is distinct from (v_patch->>'expectedUpdatedAt')::timestamptz then
      v_conflicts := v_conflicts || jsonb_build_array(v_patch->>'id'); continue;
    end if;
    if (v_values ? 'name' and (jsonb_typeof(v_values->'name') <> 'string' or length(btrim(v_values->>'name')) < 1 or length(v_values->>'name') > 100))
      or (v_values ? 'description' and (jsonb_typeof(v_values->'description') not in ('string','null') or length(v_values->>'description') > 500))
      or (v_values ? 'price' and (jsonb_typeof(v_values->'price') <> 'number' or (v_values->>'price')::numeric not between .01 and 99999999.99 or round((v_values->>'price')::numeric,2) <> (v_values->>'price')::numeric))
      or (v_values ? 'is_available' and jsonb_typeof(v_values->'is_available') <> 'boolean') then
      return jsonb_build_object('ok',false,'error','invalid_values','conflicts',jsonb_build_array(v_item.id));
    end if;
    if v_values ? 'category_id' and not exists(select 1 from public.menu_categories where id = (v_values->>'category_id')::uuid and restaurant_id = p_restaurant_id and deleted_at is null) then
      v_conflicts := v_conflicts || jsonb_build_array(v_item.id); continue;
    end if;
    v_before := '{}'; v_after := '{}';
    for v_field in select jsonb_object_keys(v_values) loop
      if to_jsonb(v_item)->v_field is distinct from v_values->v_field then
        v_before := v_before || jsonb_build_object(v_field,to_jsonb(v_item)->v_field);
        v_after := v_after || jsonb_build_object(v_field,v_values->v_field);
      end if;
    end loop;
    if v_before <> '{}' then v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'id',v_item.id,'name',v_item.name,'before',v_before,'after',v_after,'beforeVersion',v_item.updated_at)); end if;
  end loop;
  if jsonb_array_length(v_conflicts) > 0 then return jsonb_build_object('ok',false,'error','conflict','conflicts',v_conflicts); end if;
  if p_mode = 'preview' or v_changes = '[]' then return jsonb_build_object('ok',true,'changes',v_changes); end if;

  v_patches := v_changes; v_changes := '[]';
  for v_patch in select value from jsonb_array_elements(v_patches) loop
    v_values := v_patch->'after';
    update public.menu_items set
      name = case when v_values ? 'name' then v_values->>'name' else name end,
      description = case when v_values ? 'description' then v_values->>'description' else description end,
      price = case when v_values ? 'price' then (v_values->>'price')::numeric else price end,
      category_id = case when v_values ? 'category_id' then (v_values->>'category_id')::uuid else category_id end,
      is_available = case when v_values ? 'is_available' then (v_values->>'is_available')::boolean else is_available end
    where id = (v_patch->>'id')::uuid returning * into v_item;
    v_changes := v_changes || jsonb_build_array(v_patch || jsonb_build_object('afterVersion',v_item.updated_at));
  end loop;
  select coalesce(nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),'Ekip üyesi') into v_label from auth.users where id = p_actor_id;
  insert into public.menu_bulk_operations(restaurant_id,actor_id,actor_label,request_id,request_payload,changes,undo_of)
    values(p_restaurant_id,p_actor_id,coalesce(v_label,'Ekip üyesi'),p_request_id,v_payload,v_changes,case when p_mode = 'undo' then p_operation_id end)
    returning * into v_operation;
  return jsonb_build_object('ok',true,'changes',v_changes,'operation',
    (to_jsonb(v_operation) - 'changes' - 'request_payload' - 'request_id' - 'restaurant_id') || jsonb_build_object('count',jsonb_array_length(v_changes),'undone_by',null));
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
  return jsonb_build_object('ok',false,'error','invalid_values');
end;
$$;
revoke all on function public.execute_menu_bulk(uuid,uuid,text,uuid,uuid,jsonb,integer) from public, anon, authenticated;
grant execute on function public.execute_menu_bulk(uuid,uuid,text,uuid,uuid,jsonb,integer) to service_role;
notify pgrst, 'reload schema';
