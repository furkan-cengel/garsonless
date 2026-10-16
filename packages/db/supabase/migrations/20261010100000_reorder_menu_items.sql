-- Manual product order inside one menu category (dashboard drag and drop).
-- Called only by the server-side menu command adapter after the dashboard
-- actor's menu access is checked, so execute is limited to service_role.
--
-- The ordered list must contain every live product of the category exactly
-- once: a stale list (a product added or removed elsewhere meanwhile) fails
-- instead of silently producing a mixed order.

create or replace function public.reorder_menu_items(
  p_restaurant_id uuid,
  p_category_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected integer;
  v_live integer;
  v_matched integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_expected := coalesce(array_length(p_ordered_ids, 1), 0);
  if v_expected = 0 or v_expected > 500 then
    raise exception 'invalid item order' using errcode = '22023';
  end if;
  if (select count(distinct id) from unnest(p_ordered_ids) as ids(id)) <> v_expected then
    raise exception 'item ids must be unique' using errcode = '22023';
  end if;

  perform 1
  from public.menu_categories category
  where category.id = p_category_id
    and category.restaurant_id = p_restaurant_id
    and category.deleted_at is null
  for share;
  if not found then
    raise exception 'invalid category' using errcode = '22023';
  end if;

  -- Lock the category's live products so a concurrent create/delete waits.
  perform 1
  from public.menu_items item
  where item.category_id = p_category_id
    and item.deleted_at is null
  for update;

  select count(*), count(*) filter (where item.id = any(p_ordered_ids))
  into v_live, v_matched
  from public.menu_items item
  where item.category_id = p_category_id
    and item.deleted_at is null;
  if v_live <> v_expected or v_matched <> v_expected then
    raise exception 'stale item order' using errcode = '40001';
  end if;

  update public.menu_items as item
  set position = ordered.position - 1
  from unnest(p_ordered_ids) with ordinality as ordered(id, position)
  where item.id = ordered.id
    and item.category_id = p_category_id
    and item.deleted_at is null;
end;
$$;

revoke all on function public.reorder_menu_items(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_menu_items(uuid, uuid, uuid[]) to service_role;
