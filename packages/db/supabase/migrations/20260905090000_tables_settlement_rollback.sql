-- Audit T01: collect-and-close must not retain payments when close fails.
create or replace function public.settle_session_and_close_atomic(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_settlements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_access jsonb;
  v_input_count integer;
  v_matched_count integer;
  v_outcome text;
  v_settled_order_ids jsonb;
begin
  select public.read_tables_command_access_bundle(p_restaurant_id, p_actor_user_id)
  into v_access;
  if coalesce((v_access ->> 'authorized')::boolean, false) is not true then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_settlements is null or jsonb_typeof(p_settlements) <> 'array' then
    raise exception 'invalid_settlements' using errcode = '22023';
  end if;

  select count(*) into v_input_count from jsonb_array_elements(p_settlements);
  if v_input_count > 500 then raise exception 'too_many_settlements' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
    where entry.order_id is null or entry.method is null or entry.method not in ('cash', 'pos', 'comp')
  ) then raise exception 'invalid_settlement_entry' using errcode = '22023'; end if;
  if (
    select count(distinct entry.order_id)
    from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
  ) <> v_input_count then raise exception 'duplicate_settlement_order' using errcode = '22023'; end if;

  perform 1 from public.table_sessions session
  where session.id = p_session_id and session.restaurant_id = p_restaurant_id
  for update;
  if not found then return jsonb_build_object('outcome', 'not_found', 'settledOrderIds', '[]'::jsonb); end if;

  if exists (select 1 from public.table_sessions where id = p_session_id and closed_at is not null) then
    return jsonb_build_object('outcome', 'already_closed', 'settledOrderIds', '[]'::jsonb);
  end if;

  select count(*) into v_matched_count
  from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
  join public.orders orders on orders.id = entry.order_id
    and orders.restaurant_id = p_restaurant_id
    and orders.table_session_id = p_session_id
    and orders.deleted_at is null and orders.status <> 'cancelled';
  if v_matched_count <> v_input_count then
    raise exception 'settlement_order_scope_mismatch' using errcode = '22023';
  end if;

  -- Roll back payment writes as well as close side effects on a rejected close.
  begin
    with entries as (
      select entry.order_id, entry.method
      from jsonb_to_recordset(p_settlements) as entry(order_id uuid, method text)
    ), settled as (
      update public.orders orders
      set paid_at = now(), payment_method = entries.method,
        settled_by = p_actor_user_id, updated_at = now()
      from entries
      where orders.id = entries.order_id
        and orders.restaurant_id = p_restaurant_id
        and orders.table_session_id = p_session_id
        and orders.deleted_at is null and orders.status <> 'cancelled'
        and orders.paid_at is null
      returning orders.id
    )
    select coalesce(jsonb_agg(id), '[]'::jsonb) into v_settled_order_ids from settled;

    select public.close_table_session_atomic(p_session_id, p_restaurant_id, null)
    into v_outcome;
    if v_outcome is distinct from 'closed_normal' then
      raise exception using errcode = 'PT001', message = 'settlement_close_rejected';
    end if;
  exception when sqlstate 'PT001' then
    -- PL/pgSQL keeps local variables while rolling back the subtransaction.
    return jsonb_build_object('outcome', v_outcome, 'settledOrderIds', '[]'::jsonb);
  end;
  return jsonb_build_object('outcome', v_outcome, 'settledOrderIds', v_settled_order_ids);
end;
$$;

revoke all on function public.settle_session_and_close_atomic(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.settle_session_and_close_atomic(uuid,uuid,uuid,jsonb) to service_role;
