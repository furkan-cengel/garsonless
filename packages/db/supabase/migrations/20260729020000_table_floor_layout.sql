alter table public.tables
  add column if not exists layout_x_bp smallint,
  add column if not exists layout_y_bp smallint,
  add column if not exists layout_shape text not null default 'rectangle',
  add column if not exists layout_rotation smallint not null default 0,
  add column if not exists seat_count smallint not null default 4;

alter table public.tables
  drop constraint if exists tables_layout_coordinates_check,
  drop constraint if exists tables_layout_shape_check,
  drop constraint if exists tables_layout_rotation_check,
  drop constraint if exists tables_seat_count_check;

alter table public.tables
  add constraint tables_layout_coordinates_check check (
    (layout_x_bp is null and layout_y_bp is null)
    or (
      layout_x_bp between 0 and 10000
      and layout_y_bp between 0 and 10000
    )
  ),
  add constraint tables_layout_shape_check
    check (layout_shape in ('square', 'rectangle')),
  add constraint tables_layout_rotation_check
    check (layout_rotation in (0, 90)),
  add constraint tables_seat_count_check
    check (seat_count between 1 and 20);

alter table public.restaurants
  add column if not exists table_layout_revision bigint not null default 0,
  add column if not exists table_layout_initialized_at timestamptz;

alter table public.restaurants
  drop constraint if exists restaurants_table_layout_revision_nonnegative;

alter table public.restaurants
  add constraint restaurants_table_layout_revision_nonnegative
  check (table_layout_revision >= 0);

create table if not exists public.table_layout_requests (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id uuid not null,
  request_intent jsonb not null,
  result jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, request_id),
  constraint table_layout_requests_intent_object_check
    check (jsonb_typeof(request_intent) = 'object'),
  constraint table_layout_requests_result_object_check
    check (jsonb_typeof(result) = 'object')
);

alter table public.table_layout_requests enable row level security;
revoke all on table public.table_layout_requests from public, anon, authenticated;
grant select, insert on table public.table_layout_requests to service_role;

create or replace function public.restaurant_table_layout_snapshot(
  p_restaurant_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'revision', restaurant.table_layout_revision,
    'initializedAt', restaurant.table_layout_initialized_at,
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tableId', table_row.id,
          'xBp', table_row.layout_x_bp,
          'yBp', table_row.layout_y_bp,
          'shape', table_row.layout_shape,
          'rotation', table_row.layout_rotation,
          'seatCount', table_row.seat_count
        ) order by table_row.label, table_row.id
      )
      from public.tables table_row
      where table_row.restaurant_id = restaurant.id
        and table_row.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.deleted_at is null;
$$;

revoke all on function public.restaurant_table_layout_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.restaurant_table_layout_snapshot(uuid)
  to service_role;

create or replace function public.save_restaurant_table_layout(
  p_restaurant_id uuid,
  p_expected_revision bigint,
  p_request_id uuid,
  p_entries jsonb,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_existing public.table_layout_requests%rowtype;
  v_canonical_entries jsonb;
  v_intent jsonb;
  v_result jsonb;
  v_entry_count integer;
begin
  if p_request_id is null or p_actor_id is null then
    raise exception 'invalid_table_layout_identity' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid_table_layout_revision' using errcode = '22023';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'invalid_table_layout_entries' using errcode = '22023';
  end if;

  v_entry_count := jsonb_array_length(p_entries);
  if v_entry_count < 1 or v_entry_count > 500 then
    raise exception 'invalid_table_layout_entry_count' using errcode = '22023';
  end if;

  begin
    select jsonb_agg(
      jsonb_build_object(
        'tableId', parsed.table_id,
        'xBp', parsed.x_bp,
        'yBp', parsed.y_bp,
        'shape', parsed.shape,
        'rotation', parsed.rotation,
        'seatCount', parsed.seat_count
      ) order by parsed.table_id
    ) into v_canonical_entries
    from (
      select
        (entry ->> 'tableId')::uuid as table_id,
        (entry ->> 'xBp')::integer as x_bp,
        (entry ->> 'yBp')::integer as y_bp,
        entry ->> 'shape' as shape,
        (entry ->> 'rotation')::integer as rotation,
        (entry ->> 'seatCount')::integer as seat_count
      from jsonb_array_elements(p_entries) entry
    ) parsed;
  exception when others then
    raise exception 'invalid_table_layout_entries' using errcode = '22023';
  end;

  if exists (
    select 1
    from jsonb_to_recordset(v_canonical_entries) as entry(
      "tableId" uuid, "xBp" integer, "yBp" integer,
      shape text, rotation integer, "seatCount" integer
    )
    where entry."tableId" is null
      or entry."xBp" is null
      or entry."xBp" not between 0 and 10000
      or entry."yBp" is null
      or entry."yBp" not between 0 and 10000
      or entry.shape is null
      or entry.shape not in ('square', 'rectangle')
      or entry.rotation is null
      or entry.rotation not in (0, 90)
      or entry."seatCount" is null
      or entry."seatCount" not between 1 and 20
  ) then
    raise exception 'invalid_table_layout_entries' using errcode = '22023';
  end if;

  if (
    select count(distinct entry."tableId")
    from jsonb_to_recordset(v_canonical_entries) as entry("tableId" uuid)
  ) <> v_entry_count then
    raise exception 'duplicate_table_layout_entry' using errcode = '22023';
  end if;

  v_intent := jsonb_build_object(
    'expectedRevision', p_expected_revision,
    'entries', v_canonical_entries
  );

  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || ':' || p_request_id::text, 0
  ));

  select * into v_existing
  from public.table_layout_requests request
  where request.restaurant_id = p_restaurant_id
    and request.request_id = p_request_id
  for update;

  if found then
    if v_existing.request_intent <> v_intent then
      raise exception 'table_layout_idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_restaurant
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.deleted_at is null
  for update;

  if not found then
    raise exception 'restaurant_not_found' using errcode = 'P0002';
  end if;

  if v_restaurant.table_layout_revision <> p_expected_revision then
    return jsonb_build_object(
      'outcome', 'conflict',
      'idempotent', false,
      'snapshot', public.restaurant_table_layout_snapshot(p_restaurant_id)
    );
  end if;

  perform table_row.id
  from public.tables table_row
  join jsonb_to_recordset(v_canonical_entries) as entry("tableId" uuid)
    on entry."tableId" = table_row.id
  where table_row.restaurant_id = p_restaurant_id
    and table_row.deleted_at is null
  order by table_row.id
  for update of table_row;

  if (
    select count(*)
    from public.tables table_row
    join jsonb_to_recordset(v_canonical_entries) as entry("tableId" uuid)
      on entry."tableId" = table_row.id
    where table_row.restaurant_id = p_restaurant_id
      and table_row.deleted_at is null
  ) <> v_entry_count then
    raise exception 'table_layout_table_not_found' using errcode = 'P0002';
  end if;

  update public.tables table_row
  set layout_x_bp = entry."xBp",
      layout_y_bp = entry."yBp",
      layout_shape = entry.shape,
      layout_rotation = entry.rotation,
      seat_count = entry."seatCount",
      updated_at = now()
  from jsonb_to_recordset(v_canonical_entries) as entry(
    "tableId" uuid, "xBp" integer, "yBp" integer,
    shape text, rotation integer, "seatCount" integer
  )
  where table_row.id = entry."tableId"
    and table_row.restaurant_id = p_restaurant_id
    and table_row.deleted_at is null;

  update public.restaurants restaurant
  set table_layout_revision = restaurant.table_layout_revision + 1,
      table_layout_initialized_at = coalesce(restaurant.table_layout_initialized_at, now()),
      updated_at = now()
  where restaurant.id = p_restaurant_id;

  v_result := jsonb_build_object(
    'outcome', 'saved',
    'idempotent', false,
    'snapshot', public.restaurant_table_layout_snapshot(p_restaurant_id)
  );

  insert into public.table_layout_requests(
    restaurant_id, request_id, request_intent, result, created_by
  ) values (
    p_restaurant_id, p_request_id, v_intent, v_result, p_actor_id
  );

  return v_result;
end;
$$;

revoke all on function public.save_restaurant_table_layout(uuid,bigint,uuid,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.save_restaurant_table_layout(uuid,bigint,uuid,jsonb,uuid)
  to service_role;

comment on function public.save_restaurant_table_layout(uuid,bigint,uuid,jsonb,uuid) is
  'Atomically saves a tenant-scoped table layout with revision CAS and immutable request-id intent.';
