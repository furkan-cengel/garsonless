create or replace function public.reorder_menu_categories(
  p_restaurant_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_expected integer;
  v_matched integer;
  v_parent_id uuid;
begin
  if auth.role() <> 'service_role'
    and not public.has_restaurant_section(p_restaurant_id, 'menu') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_expected := coalesce(array_length(p_ordered_ids, 1), 0);
  if v_expected = 0 then return; end if;
  if (select count(distinct id) from unnest(p_ordered_ids) as ids(id)) <> v_expected then
    raise exception 'category ids must be unique' using errcode = '22023';
  end if;

  select parent_id into v_parent_id
  from public.menu_categories
  where restaurant_id = p_restaurant_id
    and deleted_at is null
    and id = p_ordered_ids[1];
  if not found then
    raise exception 'invalid category selection' using errcode = '22023';
  end if;

  select count(*) into v_matched
  from public.menu_categories
  where restaurant_id = p_restaurant_id
    and parent_id is not distinct from v_parent_id
    and deleted_at is null
    and id = any(p_ordered_ids);
  if v_matched <> v_expected then
    raise exception 'categories must share a parent' using errcode = '22023';
  end if;

  update public.menu_categories as category
  set position = ordered.position - 1
  from unnest(p_ordered_ids) with ordinality as ordered(id, position)
  where category.id = ordered.id
    and category.restaurant_id = p_restaurant_id
    and category.parent_id is not distinct from v_parent_id
    and category.deleted_at is null;
end;
$$;

revoke all on function public.reorder_menu_categories(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_menu_categories(uuid, uuid[]) to authenticated, service_role;
