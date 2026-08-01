-- First-class table locations make operational floor/area filters durable.
-- Null means "not assigned"; non-null values are normalized at command edges.
alter table public.tables
  add column if not exists floor_label text,
  add column if not exists area_label text;

alter table public.tables
  drop constraint if exists tables_floor_label_valid,
  add constraint tables_floor_label_valid check (
    floor_label is null
    or (floor_label = btrim(floor_label) and char_length(floor_label) between 1 and 40)
  ),
  drop constraint if exists tables_area_label_valid,
  add constraint tables_area_label_valid check (
    area_label is null
    or (area_label = btrim(area_label) and char_length(area_label) between 1 and 40)
  );

create index if not exists tables_restaurant_location_idx
  on public.tables (restaurant_id, floor_label, area_label)
  where deleted_at is null;

-- Keep the established plan-limit function as the single entitlement writer.
-- This wrapper enriches the row inside the same transaction, so a successful
-- create can never become visible without its requested operational location.
create or replace function public.create_located_table_with_plan_limit(
  p_restaurant_id uuid,
  p_label text,
  p_floor_label text,
  p_area_label text
)
returns table (
  outcome text,
  table_id uuid,
  token uuid,
  table_limit integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_floor_label text := nullif(btrim(p_floor_label), '');
  v_area_label text := nullif(btrim(p_area_label), '');
  v_result record;
begin
  if char_length(v_floor_label) > 40 or char_length(v_area_label) > 40 then
    return query select 'invalid_location'::text, null::uuid, null::uuid, null::integer;
    return;
  end if;

  select created.outcome, created.table_id, created.token, created.table_limit
    into v_result
  from public.create_table_with_plan_limit(p_restaurant_id, p_label) created;

  if v_result.outcome = 'created' and v_result.table_id is not null then
    update public.tables
      set floor_label = v_floor_label,
          area_label = v_area_label,
          updated_at = now()
    where id = v_result.table_id
      and restaurant_id = p_restaurant_id;
  end if;

  return query select
    v_result.outcome::text,
    v_result.table_id::uuid,
    v_result.token::uuid,
    v_result.table_limit::integer;
end;
$$;

revoke all on function public.create_located_table_with_plan_limit(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_located_table_with_plan_limit(uuid, text, text, text)
  to service_role;
