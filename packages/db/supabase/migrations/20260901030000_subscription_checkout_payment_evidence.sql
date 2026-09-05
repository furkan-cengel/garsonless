-- Phase 1: a hosted checkout becomes entitlement-authoritative only after
-- durable payment evidence. A signature-verified webhook and an authenticated
-- iyzico retrieve/search response converge on the same first-success-wins
-- payment transition. The browser callback itself is never payment evidence.

begin;

-- The previous add-on trigger followed the provider-operation status. That
-- status is orchestration state, not money state, so it must not grant access.
drop trigger if exists activate_subscription_checkout_add_ons
  on public.billing_provider_operations;
drop function if exists public.activate_subscription_checkout_add_ons();

create function public.activate_paid_subscription_invoice_add_ons()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
begin
  if new.status <> 'paid'
    or (tg_op = 'UPDATE' and old.status = 'paid')
    or not (new.add_ons @> array['iyzico_online_payments']::text[]) then
    return new;
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where id = new.subscription_id
    and restaurant_id = new.restaurant_id
    and status = 'active';

  -- Payment may legitimately complete while a platform-admin manual hold is
  -- active. Money is recorded, but the add-on remains unavailable.
  if not found then
    return new;
  end if;
  if new.plan <> 'pro'
    or v_subscription.current_period_start is distinct from new.period_start
    or v_subscription.current_period_end is distinct from new.period_end then
    raise exception 'billing_add_on_paid_invoice_context_invalid' using errcode = 'P0001';
  end if;

  insert into public.restaurant_subscription_add_ons (
    restaurant_id, add_on, subscription_id, status,
    current_period_start, current_period_end, activated_at, cancelled_at
  ) values (
    new.restaurant_id, 'iyzico_online_payments', new.subscription_id, 'active',
    new.period_start, new.period_end, coalesce(new.paid_at, clock_timestamp()), null
  )
  on conflict (restaurant_id, add_on) do update set
    subscription_id = excluded.subscription_id,
    status = 'active',
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    activated_at = excluded.activated_at,
    cancelled_at = null,
    updated_at = clock_timestamp();

  return new;
end;
$$;

-- Deferred execution is important: record_subscription_payment_success_atomic
-- marks the invoice paid before it changes the subscription to active.
create constraint trigger activate_paid_subscription_invoice_add_ons
  after insert or update on public.subscription_invoices
  deferrable initially deferred
  for each row execute function public.activate_paid_subscription_invoice_add_ons();

create function public.assert_succeeded_checkout_has_paid_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.operation_type = 'checkout.initialize' and new.status = 'succeeded' then
    if new.subscription_id is null or new.invoice_id is null or not exists (
      select 1
      from public.subscription_invoices invoice
      where invoice.id = new.invoice_id
        and invoice.restaurant_id = new.restaurant_id
        and invoice.subscription_id = new.subscription_id
        and invoice.status = 'paid'
        and invoice.amount_paid_minor = invoice.amount_due_minor
        and invoice.paid_at is not null
    ) then
      raise exception 'billing_checkout_payment_invariant_broken' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger assert_succeeded_checkout_has_paid_invoice
  after insert or update on public.billing_provider_operations
  for each row execute function public.assert_succeeded_checkout_has_paid_invoice();

create or replace function public.finalize_subscription_checkout_operation(
  p_operation_id uuid,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_plan_ref text,
  p_provider_invoice_ref text,
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
  v_subscription public.billing_subscriptions%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_event public.billing_provider_events%rowtype;
  v_payment_result jsonb;
  v_expected_plan_ref text;
  v_evidence_key text;
  v_evidence_payload jsonb;
  v_evidence_hash text;
  v_paid_at timestamptz := clock_timestamp();
begin
  if coalesce(char_length(btrim(p_provider_customer_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_subscription_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_plan_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_invoice_ref)), 0) not between 1 and 200
    or p_period_start is null
    or p_period_end is null
    or p_period_end <= p_period_start then
    raise exception 'billing_checkout_payment_evidence_invalid' using errcode = '22023';
  end if;

  select * into v_operation
  from public.billing_provider_operations
  where id = p_operation_id
  for update;

  if not found or v_operation.operation_type <> 'checkout.initialize' then
    raise exception 'billing_checkout_operation_not_found' using errcode = 'P0002';
  end if;

  v_expected_plan_ref := v_operation.result_sanitized->>'expectedProviderPlanRef';
  if coalesce(char_length(btrim(v_expected_plan_ref)), 0) not between 1 and 200
    or btrim(v_expected_plan_ref) <> btrim(p_provider_plan_ref) then
    raise exception 'billing_checkout_provider_plan_mismatch' using errcode = 'P0001';
  end if;

  if v_operation.status = 'succeeded' then
    select * into v_invoice
    from public.subscription_invoices
    where id = v_operation.invoice_id
      and restaurant_id = v_operation.restaurant_id
      and subscription_id = v_operation.subscription_id;
    if not found
      or v_invoice.status <> 'paid'
      or v_invoice.amount_paid_minor <> v_invoice.amount_due_minor
      or v_operation.provider_subscription_ref is distinct from btrim(p_provider_subscription_ref)
      or v_invoice.provider_invoice_ref is distinct from btrim(p_provider_invoice_ref) then
      raise exception 'billing_checkout_payment_invariant_broken' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'restaurantId', v_operation.restaurant_id,
      'subscriptionId', v_operation.subscription_id,
      'invoiceId', v_operation.invoice_id,
      'invoiceStatus', 'paid',
      'paymentEvidence', 'authenticated_retrieve',
      'duplicate', true
    );
  end if;

  if v_operation.status not in ('awaiting_callback', 'requires_reconciliation')
    or v_operation.requested_plan not in ('starter', 'plus', 'pro')
    or v_operation.billing_interval not in ('monthly', 'annual')
    or v_operation.amount_minor is null
    or v_operation.amount_minor <= 0
    or v_operation.currency <> 'TRY' then
    raise exception 'billing_checkout_finalize_invalid' using errcode = '22023';
  end if;

  update public.billing_customers
  set provider_customer_ref = btrim(p_provider_customer_ref)
  where id = v_operation.billing_customer_id
    and restaurant_id = v_operation.restaurant_id
    and (provider_customer_ref is null or provider_customer_ref = btrim(p_provider_customer_ref));
  if not found then
    raise exception 'billing_checkout_customer_conflict' using errcode = 'P0001';
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where restaurant_id = v_operation.restaurant_id
    and status <> 'cancelled'
  order by created_at desc
  limit 1
  for update;

  if found then
    if v_subscription.provider_subscription_ref is not null
      and v_subscription.provider_subscription_ref <> btrim(p_provider_subscription_ref) then
      raise exception 'billing_live_subscription_conflict' using errcode = 'P0001';
    end if;
    update public.billing_subscriptions
    set billing_customer_id = v_operation.billing_customer_id,
        provider = 'iyzico',
        provider_subscription_ref = btrim(p_provider_subscription_ref),
        intended_plan = v_operation.requested_plan,
        billing_interval = v_operation.billing_interval,
        version = version + 1
    where id = v_subscription.id
    returning * into v_subscription;
  else
    -- Mapping is created in a locked, non-entitled state. Only the common
    -- payment-success transition below may make it active.
    insert into public.billing_subscriptions (
      restaurant_id, billing_customer_id, provider, provider_subscription_ref,
      plan, intended_plan, billing_interval, status
    ) values (
      v_operation.restaurant_id, v_operation.billing_customer_id, 'iyzico',
      btrim(p_provider_subscription_ref), v_operation.requested_plan,
      v_operation.requested_plan, v_operation.billing_interval, 'trial_expired'
    )
    returning * into v_subscription;
  end if;

  insert into public.subscription_invoices (
    restaurant_id, subscription_id, provider_invoice_ref, idempotency_key,
    plan, add_ons, billing_interval, amount_due_minor, status,
    period_start, period_end, due_at, finalized_at
  ) values (
    v_operation.restaurant_id, v_subscription.id, btrim(p_provider_invoice_ref),
    v_operation.idempotency_key || ':invoice', v_operation.requested_plan,
    v_operation.requested_add_ons, v_operation.billing_interval,
    v_operation.amount_minor, 'open', p_period_start, p_period_end,
    v_operation.due_at, v_paid_at
  )
  returning * into v_invoice;

  v_evidence_key := 'checkout-retrieve:' || v_operation.id;
  v_evidence_payload := jsonb_build_object(
    'source', 'authenticated_retrieve',
    'operationId', v_operation.id,
    'providerCustomerRef', btrim(p_provider_customer_ref),
    'providerSubscriptionRef', btrim(p_provider_subscription_ref),
    'providerPlanRef', btrim(p_provider_plan_ref),
    'providerInvoiceRef', btrim(p_provider_invoice_ref),
    'amountMinor', v_operation.amount_minor,
    'currency', 'TRY',
    'periodStart', p_period_start,
    'periodEnd', p_period_end
  );
  v_evidence_hash := encode(
    extensions.digest(convert_to(v_evidence_payload::text, 'utf8'), 'sha256'),
    'hex'
  );

  insert into public.billing_provider_events (
    provider, provider_event_id, event_type, restaurant_id, subscription_id,
    payload_sanitized, payload_hash, status, available_at
  ) values (
    'iyzico', v_evidence_key, 'invoice.payment_succeeded',
    v_operation.restaurant_id, v_subscription.id,
    v_evidence_payload, v_evidence_hash, 'received', v_paid_at
  )
  returning * into v_event;

  v_payment_result := public.record_subscription_payment_success_atomic(
    v_operation.restaurant_id,
    v_subscription.id,
    v_invoice.id,
    v_event.id,
    btrim(p_provider_invoice_ref),
    v_operation.amount_minor,
    v_paid_at,
    v_evidence_key
  );

  if v_payment_result->>'invoiceStatus' <> 'paid' then
    raise exception 'billing_checkout_payment_transition_failed' using errcode = 'P0001';
  end if;

  update public.billing_subscriptions
  set current_period_start = p_period_start,
      current_period_end = p_period_end,
      billing_interval = v_operation.billing_interval,
      intended_plan = null,
      trial_ends_at = null,
      version = version + 1
  where id = v_subscription.id
  returning * into v_subscription;

  -- A webhook can race ahead of the authenticated retrieve before local
  -- invoice mapping exists. The retrieve is authoritative payment evidence,
  -- so matching durable events and their reconciliation jobs are resolved.
  with resolved_events as (
    update public.billing_provider_events event
    set restaurant_id = v_operation.restaurant_id,
        subscription_id = v_subscription.id,
        status = 'processed',
        attempts = event.attempts + 1,
        processed_at = v_paid_at,
        locked_at = null,
        locked_by = null,
        last_error = null
    where event.provider = 'iyzico'
      and event.id <> v_event.id
      and event.status <> 'processed'
      and event.event_type in ('invoice.payment_succeeded', 'invoice.payment_failed')
      and event.payload_sanitized->>'subscriptionReferenceCode' = btrim(p_provider_subscription_ref)
      and event.payload_sanitized->>'orderReferenceCode' = btrim(p_provider_invoice_ref)
    returning event.provider_event_id
  )
  update public.billing_reconciliation_jobs job
  set status = 'resolved',
      completed_at = v_paid_at,
      locked_at = null,
      locked_by = null,
      discrepancy_code = null,
      last_error = null
  where job.dedupe_key in (
    select 'iyzico-event:' || provider_event_id from resolved_events
  );

  update public.billing_provider_operations
  set status = 'succeeded',
      subscription_id = v_subscription.id,
      invoice_id = v_invoice.id,
      provider_subscription_ref = btrim(p_provider_subscription_ref),
      result_sanitized = result_sanitized || jsonb_build_object(
        'providerPlanRef', btrim(p_provider_plan_ref),
        'providerInvoiceRef', btrim(p_provider_invoice_ref),
        'paymentEvidence', 'authenticated_retrieve',
        'paymentEventId', v_event.id
      ),
      completed_at = v_paid_at,
      last_error = null
  where id = v_operation.id;

  return jsonb_build_object(
    'restaurantId', v_operation.restaurant_id,
    'subscriptionId', v_subscription.id,
    'invoiceId', v_invoice.id,
    'invoiceStatus', 'paid',
    'paymentEvidence', 'authenticated_retrieve',
    'duplicate', false
  );
end;
$$;

-- Historical rows are never auto-promoted to paid. Surface any legacy
-- succeeded/open checkout for an operator-led provider reconciliation.
insert into public.billing_reconciliation_jobs (
  restaurant_id, subscription_id, provider, scope, dedupe_key, status,
  scheduled_at, completed_at, local_snapshot, provider_snapshot_sanitized,
  discrepancy_code, last_error
)
select operation.restaurant_id, operation.subscription_id, 'iyzico', 'invoice',
  'checkout-unpaid:' || operation.id, 'discrepancy', clock_timestamp(),
  clock_timestamp(),
  jsonb_build_object(
    'operationId', operation.id,
    'invoiceId', operation.invoice_id,
    'operationStatus', operation.status,
    'invoiceStatus', invoice.status
  ),
  '{}'::jsonb,
  'checkout_succeeded_invoice_unpaid',
  'Authenticated provider reconciliation is required; payment was not inferred.'
from public.billing_provider_operations operation
join public.subscription_invoices invoice
  on invoice.id = operation.invoice_id
 and invoice.restaurant_id = operation.restaurant_id
where operation.operation_type = 'checkout.initialize'
  and operation.status = 'succeeded'
  and invoice.status <> 'paid'
on conflict (dedupe_key) do nothing;

revoke all on function public.activate_paid_subscription_invoice_add_ons()
  from public, anon, authenticated;
revoke all on function public.assert_succeeded_checkout_has_paid_invoice()
  from public, anon, authenticated;
revoke all on function public.finalize_subscription_checkout_operation(
  uuid,text,text,text,text,timestamptz,timestamptz
) from public, anon, authenticated;
grant execute on function public.finalize_subscription_checkout_operation(
  uuid,text,text,text,text,timestamptz,timestamptz
) to service_role;

comment on function public.finalize_subscription_checkout_operation(
  uuid,text,text,text,text,timestamptz,timestamptz
) is 'Atomically maps an authenticated iyzico checkout retrieve to the common paid-invoice transition; browser callbacks alone grant no access.';
comment on function public.assert_succeeded_checkout_has_paid_invoice()
  is 'Rejects new checkout success state unless its exact local invoice is fully paid.';

commit;
