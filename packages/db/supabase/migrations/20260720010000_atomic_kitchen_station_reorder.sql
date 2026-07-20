-- A station reorder is one tenant-scoped state transition, not N independent
-- updates. This prevents partial order state and rejects stale/cross-tenant
-- selections before a single row is changed.

create or replace function public.reorder_kitchen_stations(
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
  v_total integer;
  v_matched integer;
begin
  if auth.role() <> 'service_role'
    and not public.is_restaurant_owner(p_restaurant_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_expected := coalesce(array_length(p_ordered_ids, 1), 0);
  if v_expected = 0 or v_expected > 100 then
    raise exception 'invalid kitchen station order' using errcode = '22023';
  end if;
  if (select count(distinct id) from unnest(p_ordered_ids) as ordered(id)) <> v_expected then
    raise exception 'kitchen station ids must be unique' using errcode = '22023';
  end if;

  -- Serialize concurrent reorders for this restaurant before checking the
  -- selected set. A concurrent writer can only observe a complete order.
  perform 1
  from public.kitchen_stations
  where restaurant_id = p_restaurant_id
  for update;

  select count(*) into v_total
  from public.kitchen_stations
  where restaurant_id = p_restaurant_id;

  if v_expected <> v_total then
    raise exception 'kitchen station selection is incomplete' using errcode = '22023';
  end if;

  select count(*) into v_matched
  from public.kitchen_stations
  where restaurant_id = p_restaurant_id
    and id = any(p_ordered_ids);

  if v_matched <> v_total then
    raise exception 'invalid kitchen station selection' using errcode = '22023';
  end if;

  update public.kitchen_stations as station
  set position = ordered.position - 1
  from unnest(p_ordered_ids) with ordinality as ordered(id, position)
  where station.id = ordered.id
    and station.restaurant_id = p_restaurant_id;
end;
$$;

revoke all on function public.reorder_kitchen_stations(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_kitchen_stations(uuid, uuid[]) to authenticated, service_role;
