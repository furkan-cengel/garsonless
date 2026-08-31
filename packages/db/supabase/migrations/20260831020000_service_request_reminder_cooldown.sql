-- A pending waiter request intentionally owns one row until staff resolve it,
-- but a guest who is still waiting must be able to alert staff again. Reuse
-- the pending aggregate after a 90-second server-side cooldown and enqueue a
-- push-only reminder event. The row lock makes concurrent taps deterministic.

create or replace function public.create_table_service_request_atomic(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_request_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_request_id uuid;
  v_existing public.service_requests%rowtype;
  v_last_notified_at timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if p_request_type not in (
    'waiter', 'clean_table', 'change_ashtray', 'table_service', 'water', 'bill'
  ) then
    raise exception 'invalid_service_request_type' using errcode = '22023';
  end if;

  perform 1
  from public.tables t
  where t.id = p_table_id
    and t.restaurant_id = p_restaurant_id
    and t.deleted_at is null
  for key share;
  if not found then
    raise exception 'table_not_found_for_restaurant' using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.service_requests sr
  where sr.restaurant_id = p_restaurant_id
    and sr.table_id = p_table_id
    and sr.request_type = p_request_type
    and sr.status = 'pending'
  for update;

  if found then
    select max(event.occurred_at) into v_last_notified_at
    from public.domain_outbox event
    where event.restaurant_id = p_restaurant_id
      and event.aggregate_type = 'service_request'
      and event.aggregate_id = v_existing.id
      and event.event_type = 'service_request.created';

    if v_last_notified_at is null
       or v_last_notified_at <= v_now - interval '90 seconds' then
      perform public.enqueue_domain_outbox_event(
        p_restaurant_id,
        'service_request',
        v_existing.id,
        'service_request.created',
        jsonb_build_object(
          'tableId', v_existing.table_id,
          'tableSessionId', v_existing.table_session_id,
          'requestType', v_existing.request_type,
          'reminder', true
        ),
        'service_request.reminder:' || v_existing.id::text || ':'
          || floor(extract(epoch from v_now) / 90)::bigint::text
      );
      return jsonb_build_object(
        'throttled', false,
        'reminded', true,
        'requestId', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'throttled', true,
      'reminded', false,
      'requestId', v_existing.id
    );
  end if;

  select ts.id into v_session_id
  from public.table_sessions ts
  where ts.restaurant_id = p_restaurant_id
    and ts.table_id = p_table_id
    and ts.closed_at is null
  limit 1;

  begin
    insert into public.service_requests (
      restaurant_id, table_id, table_session_id, request_type
    ) values (
      p_restaurant_id, p_table_id, v_session_id, p_request_type
    ) returning id into v_request_id;
  exception when unique_violation then
    -- A concurrent first tap won the partial unique key after our initial
    -- lookup. Its insert trigger owns the notification; this request is the
    -- replay and must not enqueue a second one.
    select sr.id into v_request_id
    from public.service_requests sr
    where sr.restaurant_id = p_restaurant_id
      and sr.table_id = p_table_id
      and sr.request_type = p_request_type
      and sr.status = 'pending';
    return jsonb_build_object(
      'throttled', true,
      'reminded', false,
      'requestId', v_request_id
    );
  end;

  return jsonb_build_object(
    'throttled', false,
    'reminded', false,
    'requestId', v_request_id
  );
end;
$$;

revoke all on function public.create_table_service_request_atomic(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_table_service_request_atomic(uuid, uuid, text)
  to service_role;

comment on function public.create_table_service_request_atomic(uuid, uuid, text)
  is 'Creates one pending table-service request and emits push-only reminders after a 90-second cooldown.';
