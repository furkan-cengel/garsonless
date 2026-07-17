-- Menu application commands are invoked by a server-only service-role adapter
-- after dashboard actor/tenant authorization. Keep the existing authenticated
-- RPC path for backwards compatibility while allowing the trusted adapter.

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

  select count(*) into v_matched
  from public.menu_categories
  where restaurant_id = p_restaurant_id
    and parent_id is null
    and deleted_at is null
    and id = any(p_ordered_ids);
  if v_matched <> v_expected then
    raise exception 'invalid category selection' using errcode = '22023';
  end if;

  update public.menu_categories as category
  set position = ordered.position - 1
  from unnest(p_ordered_ids) with ordinality as ordered(id, position)
  where category.id = ordered.id
    and category.restaurant_id = p_restaurant_id
    and category.parent_id is null
    and category.deleted_at is null;
end;
$$;

create or replace function public.delete_menu_category(
  p_restaurant_id uuid,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role'
    and not public.has_restaurant_section(p_restaurant_id, 'menu') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.menu_categories
    where id = p_category_id
      and restaurant_id = p_restaurant_id
      and deleted_at is null
  ) then
    raise exception 'category not found' using errcode = 'P0002';
  end if;

  update public.menu_items
  set deleted_at = v_now
  where deleted_at is null
    and category_id in (
      select id from public.menu_categories
      where restaurant_id = p_restaurant_id
        and deleted_at is null
        and (id = p_category_id or parent_id = p_category_id)
    );

  update public.menu_categories
  set deleted_at = v_now
  where restaurant_id = p_restaurant_id
    and deleted_at is null
    and (id = p_category_id or parent_id = p_category_id);
end;
$$;

create or replace function public.set_menu_items_availability(
  p_restaurant_id uuid,
  p_item_ids uuid[],
  p_is_available boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_expected integer;
  v_matched integer;
begin
  if auth.role() <> 'service_role'
    and not public.has_restaurant_section(p_restaurant_id, 'menu') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_expected := coalesce(array_length(p_item_ids, 1), 0);
  if v_expected = 0 or v_expected > 500 then
    raise exception 'invalid item selection' using errcode = '22023';
  end if;
  if (select count(distinct id) from unnest(p_item_ids) as ids(id)) <> v_expected then
    raise exception 'item ids must be unique' using errcode = '22023';
  end if;

  select count(*) into v_matched
  from public.menu_items item
  join public.menu_categories category on category.id = item.category_id
  where item.id = any(p_item_ids)
    and item.deleted_at is null
    and category.restaurant_id = p_restaurant_id
    and category.deleted_at is null;
  if v_matched <> v_expected then
    raise exception 'invalid item selection' using errcode = '22023';
  end if;

  update public.menu_items
  set is_available = p_is_available
  where id = any(p_item_ids) and deleted_at is null;
end;
$$;

revoke all on function public.reorder_menu_categories(uuid, uuid[]) from public, anon;
revoke all on function public.delete_menu_category(uuid, uuid) from public, anon;
revoke all on function public.set_menu_items_availability(uuid, uuid[], boolean) from public, anon;
grant execute on function public.reorder_menu_categories(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.delete_menu_category(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_menu_items_availability(uuid, uuid[], boolean) to authenticated, service_role;
