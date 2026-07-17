-- Tables & kitchen boundary hardening.
--
-- 1. Closing an unpaid table and clearing non-provider payment intents is one
--    transaction. A provider-token-bound checkout is real-money-in-flight and
--    therefore blocks the close instead of being silently voided.
-- 2. Public service-request validation, open-session association and insert
--    share one transaction; the partial unique index remains the replay guard.
-- 3. Kitchen station ownership and the status compare-and-set are repeated
--    under the order row lock, closing the read -> authorize -> write race.

create or replace function public.close_table_session_atomic(
  p_session_id uuid,
  p_restaurant_id uuid,
  p_abnormal_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.table_sessions%rowtype;
  v_has_unpaid boolean;
  v_has_provider_payment boolean;
  v_reason text := nullif(btrim(p_abnormal_reason), '');
begin
  select * into v_session
  from public.table_sessions
  where id = p_session_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then return 'not_found'; end if;
  if v_session.closed_at is not null then return 'already_closed'; end if;

  -- Once a provider token is attached, a delayed callback can represent real
  -- money even after its short reservation lease elapsed. Never invalidate it
  -- by closing the table; staff must wait for reconciliation/provider outcome.
  select exists (
    select 1
    from public.payment_shares ps
    where ps.restaurant_id = p_restaurant_id
      and ps.table_session_id = p_session_id
      and ps.status = 'declared'
      and ps.method = 'iyzico'
      and (
        ps.checkout_reserved_until > now()
        or exists (
          select 1 from public.payment_share_tokens pst
          where pst.share_id = ps.id
        )
      )
  ) into v_has_provider_payment;

  if v_has_provider_payment then return 'payment_pending'; end if;

  select exists (
    select 1 from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.table_session_id = p_session_id
      and o.deleted_at is null
      and o.status <> 'cancelled'
      and o.paid_at is null
  ) into v_has_unpaid;

  if v_has_unpaid and v_reason is null then return 'unpaid'; end if;

  -- These intents never reached a provider and therefore cannot collect real
  -- money later. Clear them in the same transaction as the abnormal close.
  if v_has_unpaid then
    update public.payment_shares ps
    set status = 'void',
        checkout_amount = null,
        checkout_reserved_until = null,
        updated_at = now()
    where ps.restaurant_id = p_restaurant_id
      and ps.table_session_id = p_session_id
      and ps.status = 'declared'
      and not exists (
        select 1 from public.payment_share_tokens pst
        where pst.share_id = ps.id
      );
  end if;

  update public.table_sessions
  set closed_at = now(),
      updated_at = now(),
      close_reason = case when v_has_unpaid then left(v_reason, 200) else null end
  where id = p_session_id;

  return case when v_has_unpaid then 'closed_abnormal' else 'closed_normal' end;
end;
$$;

revoke all on function public.close_table_session_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.close_table_session_atomic(uuid, uuid, text) to service_role;

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
    return jsonb_build_object('throttled', true, 'requestId', null);
  end;

  return jsonb_build_object('throttled', false, 'requestId', v_request_id);
end;
$$;

revoke all on function public.create_table_service_request_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_table_service_request_atomic(uuid, uuid, text) to service_role;

create or replace function public.transition_kitchen_order_atomic(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_station_id text,
  p_target_status text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_station_ids text[];
begin
  if p_target_status not in ('preparing', 'ready') then
    raise exception 'invalid_kitchen_target_status' using errcode = '22023';
  end if;
  if coalesce(nullif(btrim(p_station_id), ''), '') = '' then
    raise exception 'invalid_kitchen_station' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
    and o.restaurant_id = p_restaurant_id
    and o.deleted_at is null
  for update;
  if not found then
    raise exception 'order_not_found_for_restaurant' using errcode = 'P0002';
  end if;

  select coalesce(
    array_agg(distinct coalesce(nullif(line -> 'station' ->> 'id', ''), 'unassigned')),
    array['unassigned']::text[]
  ) into v_station_ids
  from jsonb_array_elements(
    case when jsonb_typeof(v_order.items) = 'array' then v_order.items else '[]'::jsonb end
  ) as line;

  if p_station_id <> 'expo' and not (p_station_id = any(v_station_ids)) then
    raise exception 'order_does_not_belong_to_station' using errcode = '42501';
  end if;

  if p_target_status = 'preparing'
     and v_order.status not in ('pending', 'pending_approval', 'sent_to_kitchen', 'paid', 'preparing') then
    raise exception 'invalid_kitchen_status_transition' using errcode = 'P0001';
  end if;
  if p_target_status = 'ready'
     and v_order.status not in ('preparing', 'ready') then
    raise exception 'invalid_kitchen_status_transition' using errcode = 'P0001';
  end if;

  if p_target_status = 'ready'
     and p_station_id <> 'expo'
     and cardinality(v_station_ids) <> 1 then
    raise exception 'multi_station_order_requires_expo' using errcode = '42501';
  end if;

  if v_order.status::text = p_target_status then return true; end if;

  update public.orders
  set status = p_target_status,
      updated_at = now()
  where id = p_order_id;
  return true;
end;
$$;

revoke all on function public.transition_kitchen_order_atomic(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.transition_kitchen_order_atomic(uuid, uuid, text, text) to service_role;
