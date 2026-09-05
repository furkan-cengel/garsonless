-- Recover hosted subscription checkouts without treating a browser submit as
-- payment success. Provider tokens remain service-role-only and recovery work
-- is leased so callback, owner polling and the minute worker can race safely.

alter table public.billing_provider_operations
  add column provider_checkout_expires_at timestamptz,
  add column recovery_next_at timestamptz,
  add column recovery_attempts integer not null default 0,
  add column recovery_locked_at timestamptz,
  add column recovery_locked_by text;

alter table public.billing_provider_operations
  drop constraint if exists billing_provider_operations_status_check;
alter table public.billing_provider_operations
  add constraint billing_provider_operations_status_check
    check (status in ('processing', 'awaiting_callback', 'succeeded', 'requires_reconciliation', 'expired')),
  add constraint billing_provider_operations_recovery_attempts_check
    check (recovery_attempts >= 0),
  add constraint billing_provider_operations_recovery_lock_check
    check ((recovery_locked_at is null) = (recovery_locked_by is null)),
  add constraint billing_provider_operations_recovery_worker_check
    check (recovery_locked_by is null or char_length(btrim(recovery_locked_by)) between 1 and 160);

update public.billing_provider_operations
set provider_checkout_expires_at = created_at + interval '30 minutes',
    recovery_next_at = clock_timestamp()
where operation_type = 'checkout.initialize'
  and status = 'awaiting_callback';

create index billing_provider_operations_checkout_recovery_idx
  on public.billing_provider_operations(recovery_next_at, created_at)
  where operation_type = 'checkout.initialize' and status = 'awaiting_callback';

drop function public.mark_subscription_checkout_initialized(uuid, text);
create function public.mark_subscription_checkout_initialized(
  p_operation_id uuid,
  p_provider_checkout_ref text,
  p_provider_checkout_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expires_at timestamptz := coalesce(
    p_provider_checkout_expires_at,
    clock_timestamp() + interval '30 minutes'
  );
begin
  if char_length(btrim(p_provider_checkout_ref)) not between 1 and 200
    or v_expires_at <= clock_timestamp() then
    raise exception 'billing_checkout_reference_invalid' using errcode = '22023';
  end if;
  update public.billing_provider_operations
  set status = 'awaiting_callback',
      provider_checkout_ref = btrim(p_provider_checkout_ref),
      provider_checkout_expires_at = v_expires_at,
      recovery_next_at = clock_timestamp() + interval '2 seconds',
      recovery_attempts = 0,
      recovery_locked_at = null,
      recovery_locked_by = null,
      last_error = null
  where id = p_operation_id
    and operation_type = 'checkout.initialize'
    and status = 'processing';
  if not found then
    raise exception 'billing_checkout_operation_not_claimed' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create or replace function public.find_subscription_checkout_callback(p_provider_checkout_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_expected text;
begin
  if coalesce(char_length(btrim(p_provider_checkout_ref)), 0) not between 1 and 200 then
    raise exception 'billing_checkout_reference_invalid' using errcode = '22023';
  end if;
  select * into v_operation
  from public.billing_provider_operations
  where provider = 'iyzico'
    and operation_type = 'checkout.initialize'
    and provider_checkout_ref = btrim(p_provider_checkout_ref);
  if not found then
    raise exception 'billing_checkout_operation_not_found' using errcode = 'P0002';
  end if;
  v_expected := v_operation.result_sanitized->>'expectedProviderPlanRef';
  if v_operation.requested_plan not in ('starter', 'plus', 'pro')
    or coalesce(char_length(btrim(v_expected)), 0) not between 1 and 200
    or v_operation.provider_checkout_expires_at is null then
    raise exception 'billing_checkout_plan_binding_missing' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'operationId', v_operation.id,
    'restaurantId', v_operation.restaurant_id,
    'invoiceId', coalesce(v_operation.invoice_id, v_operation.id),
    'requestedPlan', v_operation.requested_plan,
    'expectedProviderPlanRef', v_expected,
    'expiresAt', v_operation.provider_checkout_expires_at,
    'attempts', greatest(1, v_operation.recovery_attempts)
  );
end;
$$;

create function public.claim_subscription_checkout_recovery_operation(
  p_restaurant_id uuid,
  p_operation_id uuid,
  p_worker text,
  p_lease_seconds integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_expected text;
begin
  if char_length(btrim(p_worker)) not between 1 and 160
    or p_lease_seconds not between 1 and 300 then
    raise exception 'billing_checkout_recovery_claim_invalid' using errcode = '22023';
  end if;
  select * into v_operation
  from public.billing_provider_operations
  where id = p_operation_id
    and restaurant_id = p_restaurant_id
    and operation_type = 'checkout.initialize'
  for update;
  if not found or v_operation.status <> 'awaiting_callback'
    or v_operation.provider_checkout_ref is null
    or v_operation.provider_checkout_expires_at is null then
    raise exception 'billing_checkout_recovery_not_pending' using errcode = 'P0002';
  end if;
  if v_operation.recovery_locked_at is not null
    and v_operation.recovery_locked_at > clock_timestamp() - make_interval(secs => p_lease_seconds)
    and v_operation.recovery_locked_by is distinct from btrim(p_worker) then
    raise exception 'billing_checkout_recovery_busy' using errcode = '55P03';
  end if;
  v_expected := v_operation.result_sanitized->>'expectedProviderPlanRef';
  if coalesce(char_length(btrim(v_expected)), 0) not between 1 and 200 then
    raise exception 'billing_checkout_plan_binding_missing' using errcode = 'P0001';
  end if;
  update public.billing_provider_operations
  set recovery_attempts = recovery_attempts + 1,
      recovery_locked_at = clock_timestamp(),
      recovery_locked_by = btrim(p_worker)
  where id = v_operation.id
  returning * into v_operation;
  return jsonb_build_object(
    'operationId', v_operation.id,
    'restaurantId', v_operation.restaurant_id,
    'providerCheckoutRef', v_operation.provider_checkout_ref,
    'expectedProviderPlanRef', v_expected,
    'expiresAt', v_operation.provider_checkout_expires_at,
    'attempts', v_operation.recovery_attempts
  );
end;
$$;

create function public.claim_subscription_checkout_recovery(
  p_worker text,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if char_length(btrim(p_worker)) not between 1 and 160
    or p_limit not between 1 and 100
    or p_lease_seconds not between 1 and 300 then
    raise exception 'billing_checkout_recovery_claim_invalid' using errcode = '22023';
  end if;
  with candidates as (
    select id
    from public.billing_provider_operations
    where operation_type = 'checkout.initialize'
      and status = 'awaiting_callback'
      and provider_checkout_ref is not null
      and provider_checkout_expires_at is not null
      and coalesce(recovery_next_at, created_at) <= clock_timestamp()
      and (
        recovery_locked_at is null
        or recovery_locked_at <= clock_timestamp() - make_interval(secs => p_lease_seconds)
      )
    order by coalesce(recovery_next_at, created_at), created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.billing_provider_operations operation
    set recovery_attempts = operation.recovery_attempts + 1,
        recovery_locked_at = clock_timestamp(),
        recovery_locked_by = btrim(p_worker)
    from candidates
    where operation.id = candidates.id
    returning operation.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'operationId', claimed.id,
    'restaurantId', claimed.restaurant_id,
    'providerCheckoutRef', claimed.provider_checkout_ref,
    'expectedProviderPlanRef', claimed.result_sanitized->>'expectedProviderPlanRef',
    'expiresAt', claimed.provider_checkout_expires_at,
    'attempts', claimed.recovery_attempts
  ) order by claimed.created_at), '[]'::jsonb)
  into v_result
  from claimed;
  return v_result;
end;
$$;

create function public.reschedule_subscription_checkout_recovery(
  p_operation_id uuid,
  p_worker text,
  p_next_at timestamptz,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_next_at <= clock_timestamp()
    or (p_worker is not null and char_length(btrim(p_worker)) not between 1 and 160)
    or (p_reason is not null and char_length(p_reason) > 1000) then
    raise exception 'billing_checkout_recovery_schedule_invalid' using errcode = '22023';
  end if;
  update public.billing_provider_operations
  set recovery_next_at = p_next_at,
      recovery_locked_at = null,
      recovery_locked_by = null,
      last_error = nullif(btrim(p_reason), '')
  where id = p_operation_id
    and operation_type = 'checkout.initialize'
    and status = 'awaiting_callback'
    and (p_worker is null or recovery_locked_by = btrim(p_worker));
  if not found then
    raise exception 'billing_checkout_recovery_lease_lost' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create function public.expire_subscription_checkout_recovery(
  p_operation_id uuid,
  p_worker text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_worker is not null and char_length(btrim(p_worker)) not between 1 and 160 then
    raise exception 'billing_checkout_recovery_expire_invalid' using errcode = '22023';
  end if;
  update public.billing_provider_operations
  set status = 'expired',
      recovery_next_at = null,
      recovery_locked_at = null,
      recovery_locked_by = null,
      completed_at = clock_timestamp(),
      last_error = null
  where id = p_operation_id
    and operation_type = 'checkout.initialize'
    and status = 'awaiting_callback'
    and (p_worker is null or recovery_locked_by = btrim(p_worker));
  if not found then
    raise exception 'billing_checkout_recovery_lease_lost' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create function public.clear_subscription_checkout_recovery_lease()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.operation_type = 'checkout.initialize'
    and new.status in ('succeeded', 'requires_reconciliation', 'expired') then
    new.recovery_next_at := null;
    new.recovery_locked_at := null;
    new.recovery_locked_by := null;
  end if;
  return new;
end;
$$;

create trigger clear_subscription_checkout_recovery_lease
  before update on public.billing_provider_operations
  for each row execute function public.clear_subscription_checkout_recovery_lease();

alter function public.read_subscription_billing_settings(uuid)
  rename to read_subscription_billing_settings_before_checkout_recovery;
revoke all on function public.read_subscription_billing_settings_before_checkout_recovery(uuid)
  from public, anon, authenticated, service_role;

create function public.read_subscription_billing_settings(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb;
  v_has_pending_checkout boolean;
begin
  v_settings := public.read_subscription_billing_settings_before_checkout_recovery(p_restaurant_id);
  select exists (
    select 1
    from public.billing_provider_operations pending
    where pending.restaurant_id = p_restaurant_id
      and pending.operation_type = 'checkout.initialize'
      and pending.status = 'awaiting_callback'
      and pending.provider_checkout_expires_at > clock_timestamp()
      and not exists (
        select 1
        from public.billing_provider_operations completed
        where completed.restaurant_id = pending.restaurant_id
          and completed.operation_type = 'checkout.initialize'
          and completed.status = 'succeeded'
          and coalesce(completed.completed_at, completed.updated_at) > pending.created_at
      )
  ) into v_has_pending_checkout;
  return jsonb_set(v_settings, '{attention,hasPendingCheckout}', to_jsonb(v_has_pending_checkout), true);
end;
$$;

revoke all on function public.mark_subscription_checkout_initialized(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.find_subscription_checkout_callback(text)
  from public, anon, authenticated;
revoke all on function public.claim_subscription_checkout_recovery_operation(uuid, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.claim_subscription_checkout_recovery(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.reschedule_subscription_checkout_recovery(uuid, text, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.expire_subscription_checkout_recovery(uuid, text)
  from public, anon, authenticated;
revoke all on function public.clear_subscription_checkout_recovery_lease()
  from public, anon, authenticated;
revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;

grant execute on function public.mark_subscription_checkout_initialized(uuid, text, timestamptz) to service_role;
grant execute on function public.find_subscription_checkout_callback(text) to service_role;
grant execute on function public.claim_subscription_checkout_recovery_operation(uuid, uuid, text, integer) to service_role;
grant execute on function public.claim_subscription_checkout_recovery(text, integer, integer) to service_role;
grant execute on function public.reschedule_subscription_checkout_recovery(uuid, text, timestamptz, text) to service_role;
grant execute on function public.expire_subscription_checkout_recovery(uuid, text) to service_role;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;
