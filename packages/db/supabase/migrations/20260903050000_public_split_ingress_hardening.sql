-- Public split-payment ingress hardening.
--
-- HTTP handlers bound request size and schema first. This migration provides
-- the transaction boundary that an application-only check cannot: one request
-- id creates at most one share and every open table session has a hard cap on
-- unresolved public intents.

alter table public.payment_shares
  add column if not exists request_id uuid,
  add column if not exists request_fingerprint text;

create unique index if not exists payment_shares_request_id_uidx
  on public.payment_shares(restaurant_id, request_id)
  where request_id is not null;

create or replace function public.create_split_share_guarded(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_table_session_id uuid,
  p_request_id uuid,
  p_request_fingerprint text,
  p_amount numeric,
  p_method text,
  p_customer_id uuid,
  p_label text,
  p_assigned_items jsonb,
  p_active_max integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.payment_shares%rowtype;
  v_share_id uuid;
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_active_count integer;
  v_amount numeric;
begin
  if p_request_id is null then
    raise exception 'split_request_id_required' using errcode = '22023';
  end if;
  if p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'split_request_fingerprint_invalid' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'split_amount_invalid' using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('iyzico', 'cash') then
    raise exception 'split_method_invalid' using errcode = '22023';
  end if;
  if v_label is not null and length(v_label) > 40 then
    raise exception 'split_label_invalid' using errcode = '22023';
  end if;
  if p_assigned_items is not null then
    if jsonb_typeof(p_assigned_items) <> 'array'
       or jsonb_array_length(p_assigned_items) > 50
       or octet_length(p_assigned_items::text) > 65536 then
      raise exception 'split_assigned_items_invalid' using errcode = '22023';
    end if;
  end if;
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'split_amount_invalid' using errcode = '22023';
  end if;

  -- Exact retries return the original share without consuming another active
  -- slot. Reusing an id for different semantics is rejected fail-closed.
  select * into v_existing
    from public.payment_shares share
   where share.restaurant_id = p_restaurant_id
     and share.request_id = p_request_id
   for update;
  if found then
    if v_existing.table_session_id is distinct from p_table_session_id
       or v_existing.method is distinct from p_method
       or v_existing.request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'split_request_id_conflict' using errcode = 'P0001';
    end if;
    perform 1
      from public.table_sessions session
     where session.id = p_table_session_id
       and session.restaurant_id = p_restaurant_id
       and session.table_id = p_table_id
       and session.closed_at is null;
    if not found then
      raise exception 'split_session_invalid' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'shareId', v_existing.id,
      'amount', v_existing.amount,
      'idempotent', true
    );
  end if;

  -- Serialize all new intents for one table session so concurrent requests
  -- cannot race past the active-intent bound.
  perform 1
    from public.table_sessions session
   where session.id = p_table_session_id
     and session.restaurant_id = p_restaurant_id
     and session.table_id = p_table_id
     and session.closed_at is null
   for update;
  if not found then
    raise exception 'split_session_invalid' using errcode = 'P0001';
  end if;

  -- A concurrent retry may have committed while this transaction waited for
  -- the session lock. Re-read after the lock before counting/inserting.
  select * into v_existing
    from public.payment_shares share
   where share.restaurant_id = p_restaurant_id
     and share.request_id = p_request_id
   for update;
  if found then
    if v_existing.table_session_id is distinct from p_table_session_id
       or v_existing.method is distinct from p_method
       or v_existing.request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'split_request_id_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'shareId', v_existing.id,
      'amount', v_existing.amount,
      'idempotent', true
    );
  end if;

  select count(*) into v_active_count
    from public.payment_shares share
   where share.restaurant_id = p_restaurant_id
     and share.table_session_id = p_table_session_id
     and share.status = 'declared';
  if v_active_count >= greatest(1, least(coalesce(p_active_max, 50), 100)) then
    raise exception 'split_active_intent_limit' using errcode = 'P0001';
  end if;

  begin
    insert into public.payment_shares (
      restaurant_id,
      table_session_id,
      request_id,
      request_fingerprint,
      amount,
      method,
      customer_id,
      label,
      assigned_items,
      status
    ) values (
      p_restaurant_id,
      p_table_session_id,
      p_request_id,
      p_request_fingerprint,
      v_amount,
      p_method,
      p_customer_id,
      v_label,
      p_assigned_items,
      'declared'
    ) returning id into v_share_id;
  exception when unique_violation then
    -- A request id must never silently address a different session.
    raise exception 'split_request_id_conflict' using errcode = 'P0001';
  end;

  return jsonb_build_object(
    'shareId', v_share_id,
    'amount', v_amount,
    'idempotent', false
  );
end;
$$;

revoke all on function public.create_split_share_guarded(
  uuid, uuid, uuid, uuid, text, numeric, text, uuid, text, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.create_split_share_guarded(
  uuid, uuid, uuid, uuid, text, numeric, text, uuid, text, jsonb, integer
) to service_role;

comment on function public.create_split_share_guarded(
  uuid, uuid, uuid, uuid, text, numeric, text, uuid, text, jsonb, integer
) is 'Idempotently declares a tenant/table-scoped split share with an atomic active-intent limit.';
