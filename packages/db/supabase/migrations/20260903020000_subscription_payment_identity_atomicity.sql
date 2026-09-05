-- Checkout/renewal financial transitions and their provider payment identity
-- must commit together. This migration also carries the immutable amount and
-- interval expectations into every authenticated checkout recovery claim.

begin;

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
    or v_operation.billing_interval not in ('monthly', 'annual')
    or v_operation.amount_minor is null or v_operation.amount_minor <= 0
    or v_operation.currency <> 'TRY'
    or coalesce(char_length(btrim(v_expected)), 0) not between 1 and 200
    or v_operation.provider_checkout_expires_at is null then
    raise exception 'billing_checkout_expectation_missing' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'operationId', v_operation.id,
    'restaurantId', v_operation.restaurant_id,
    'invoiceId', coalesce(v_operation.invoice_id, v_operation.id),
    'requestedPlan', v_operation.requested_plan,
    'expectedProviderPlanRef', v_expected,
    'expectedAmountMinor', v_operation.amount_minor,
    'expectedCurrency', v_operation.currency,
    'expectedBillingInterval', v_operation.billing_interval,
    'expiresAt', v_operation.provider_checkout_expires_at,
    'attempts', greatest(1, v_operation.recovery_attempts)
  );
end;
$$;

create or replace function public.claim_subscription_checkout_recovery_operation(
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
  if coalesce(char_length(btrim(v_expected)), 0) not between 1 and 200
    or v_operation.billing_interval not in ('monthly', 'annual')
    or v_operation.amount_minor is null or v_operation.amount_minor <= 0
    or v_operation.currency <> 'TRY' then
    raise exception 'billing_checkout_expectation_missing' using errcode = 'P0001';
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
    'expectedAmountMinor', v_operation.amount_minor,
    'expectedCurrency', v_operation.currency,
    'expectedBillingInterval', v_operation.billing_interval,
    'expiresAt', v_operation.provider_checkout_expires_at,
    'attempts', v_operation.recovery_attempts
  );
end;
$$;

create or replace function public.claim_subscription_checkout_recovery(
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
      and amount_minor > 0 and currency = 'TRY'
      and billing_interval in ('monthly', 'annual')
      and coalesce(char_length(btrim(result_sanitized->>'expectedProviderPlanRef')), 0) between 1 and 200
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
    'expectedAmountMinor', claimed.amount_minor,
    'expectedCurrency', claimed.currency,
    'expectedBillingInterval', claimed.billing_interval,
    'expiresAt', claimed.provider_checkout_expires_at,
    'attempts', claimed.recovery_attempts
  ) order by claimed.created_at), '[]'::jsonb)
  into v_result
  from claimed;
  return v_result;
end;
$$;

create function public.finalize_subscription_checkout_with_payment_identity(
  p_operation_id uuid,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_plan_ref text,
  p_provider_invoice_ref text,
  p_provider_payment_id text,
  p_provider_order_status text,
  p_amount_minor bigint,
  p_currency text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_result jsonb;
  v_invoice_id uuid;
begin
  if p_provider_order_status <> 'succeeded'
    or p_amount_minor <= 0 or p_currency <> 'TRY'
    or coalesce(char_length(btrim(p_provider_payment_id)), 0) not between 1 and 200 then
    raise exception 'billing_checkout_payment_identity_invalid' using errcode = '22023';
  end if;
  select * into v_operation
  from public.billing_provider_operations
  where id = p_operation_id
  for update;
  if not found or v_operation.operation_type <> 'checkout.initialize'
    or v_operation.amount_minor is distinct from p_amount_minor
    or v_operation.currency is distinct from p_currency
    or p_period_end is distinct from ((case v_operation.billing_interval
      when 'monthly' then timezone('UTC', p_period_start) + interval '1 month'
      when 'annual' then timezone('UTC', p_period_start) + interval '1 year'
      else null
    end) at time zone 'UTC') then
    raise exception 'billing_checkout_amount_mismatch' using errcode = 'P0001';
  end if;
  v_result := public.finalize_subscription_checkout_operation(
    p_operation_id, p_provider_customer_ref, p_provider_subscription_ref,
    p_provider_plan_ref, p_provider_invoice_ref, p_period_start, p_period_end
  );
  v_invoice_id := nullif(v_result->>'invoiceId', '')::uuid;
  perform public.bind_subscription_payment_provider_id(
    v_invoice_id, p_provider_invoice_ref, p_provider_payment_id
  );
  return v_result;
end;
$$;

create function public.hydrate_subscription_invoice_with_payment_identity(
  p_job_id uuid,
  p_provider_event_id uuid,
  p_worker text,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_invoice_ref text,
  p_provider_plan_ref text,
  p_plan text,
  p_add_ons text[],
  p_billing_interval text,
  p_amount_minor bigint,
  p_currency text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_provider_order_status text,
  p_provider_payment_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_invoice_id uuid;
begin
  if (p_provider_order_status = 'succeeded'
      and coalesce(char_length(btrim(p_provider_payment_id)), 0) not between 1 and 200)
    or (p_provider_order_status = 'failed' and p_provider_payment_id is not null) then
    raise exception 'billing_renewal_payment_identity_invalid' using errcode = '22023';
  end if;
  if p_period_end is distinct from ((case p_billing_interval
    when 'monthly' then timezone('UTC', p_period_start) + interval '1 month'
    when 'annual' then timezone('UTC', p_period_start) + interval '1 year'
    else null
  end) at time zone 'UTC') then
    raise exception 'billing_renewal_period_mismatch' using errcode = 'P0001';
  end if;
  v_result := public.hydrate_subscription_invoice_from_provider_event(
    p_job_id, p_provider_event_id, p_worker, p_provider_customer_ref,
    p_provider_subscription_ref, p_provider_invoice_ref, p_provider_plan_ref,
    p_plan, p_add_ons, p_billing_interval, p_amount_minor, p_currency,
    p_period_start, p_period_end, p_provider_order_status, p_occurred_at
  );
  if p_provider_order_status = 'succeeded' then
    v_invoice_id := nullif(v_result->>'invoiceId', '')::uuid;
    perform public.bind_subscription_payment_provider_id(
      v_invoice_id, p_provider_invoice_ref, p_provider_payment_id
    );
  end if;
  return v_result;
end;
$$;

revoke all on function public.finalize_subscription_checkout_operation(
  uuid,text,text,text,text,timestamptz,timestamptz
) from service_role;
revoke all on function public.hydrate_subscription_invoice_from_provider_event(
  uuid,uuid,text,text,text,text,text,text,text[],text,bigint,text,timestamptz,timestamptz,text,timestamptz
) from service_role;
revoke all on function public.finalize_subscription_checkout_with_payment_identity(
  uuid,text,text,text,text,text,text,bigint,text,timestamptz,timestamptz
) from public, anon, authenticated;
revoke all on function public.hydrate_subscription_invoice_with_payment_identity(
  uuid,uuid,text,text,text,text,text,text,text[],text,bigint,text,timestamptz,timestamptz,text,text,timestamptz
) from public, anon, authenticated;

grant execute on function public.finalize_subscription_checkout_with_payment_identity(
  uuid,text,text,text,text,text,text,bigint,text,timestamptz,timestamptz
) to service_role;
grant execute on function public.hydrate_subscription_invoice_with_payment_identity(
  uuid,uuid,text,text,text,text,text,text,text[],text,bigint,text,timestamptz,timestamptz,text,text,timestamptz
) to service_role;

comment on function public.finalize_subscription_checkout_with_payment_identity(
  uuid,text,text,text,text,text,text,bigint,text,timestamptz,timestamptz
) is 'Commits the paid checkout transition and its authenticated iyzico paymentId in one database transaction.';
comment on function public.hydrate_subscription_invoice_with_payment_identity(
  uuid,uuid,text,text,text,text,text,text,text[],text,bigint,text,timestamptz,timestamptz,text,text,timestamptz
) is 'Commits renewal hydration and successful iyzico paymentId binding atomically; binding failure rolls back the financial transition and reconciliation resolution.';

commit;
