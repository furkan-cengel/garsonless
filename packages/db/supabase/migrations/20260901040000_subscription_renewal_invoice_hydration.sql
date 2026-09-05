-- Phase 2: hydrate recurring iyzico orders that arrive by signed webhook with
-- a new orderReferenceCode before a local invoice exists. Hydration is leased,
-- provider-authenticated, amount/plan bound, and converges on the existing
-- first-success-wins payment transitions.

begin;

alter table public.billing_subscriptions
  add column provider_plan_ref text;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_plan_ref_check
  check (provider_plan_ref is null or char_length(btrim(provider_plan_ref)) between 1 and 200),
  add constraint billing_subscriptions_provider_plan_binding_check
  check (
    (provider is null and provider_plan_ref is null)
    or provider = 'iyzico'
  ) not valid;

update public.billing_subscriptions subscription
set provider_plan_ref = (
  select candidate.result_sanitized
  from public.billing_provider_operations candidate
  where candidate.subscription_id = subscription.id
    and candidate.operation_type = 'checkout.initialize'
    and candidate.status = 'succeeded'
    and coalesce(char_length(btrim(candidate.result_sanitized->>'providerPlanRef')), 0) between 1 and 200
  order by coalesce(candidate.completed_at, candidate.updated_at) desc
  limit 1
) ->> 'providerPlanRef'
where subscription.provider = 'iyzico'
  and subscription.provider_plan_ref is null
  and exists (
    select 1 from public.billing_provider_operations candidate
    where candidate.subscription_id = subscription.id
      and candidate.operation_type = 'checkout.initialize'
      and candidate.status = 'succeeded'
      and coalesce(char_length(btrim(candidate.result_sanitized->>'providerPlanRef')), 0) between 1 and 200
  );

-- Existing provider subscriptions without a durable checkout binding stay
-- usable but renewal auto-hydration fails closed until manually reconciled.

create function public.sync_subscription_provider_plan_ref_from_checkout()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_provider_plan_ref text;
begin
  if new.operation_type <> 'checkout.initialize'
    or new.status <> 'succeeded'
    or new.subscription_id is null then
    return new;
  end if;
  v_provider_plan_ref := new.result_sanitized->>'providerPlanRef';
  if coalesce(char_length(btrim(v_provider_plan_ref)), 0) not between 1 and 200 then
    raise exception 'billing_subscription_provider_plan_binding_missing' using errcode = 'P0001';
  end if;
  update public.billing_subscriptions
  set provider_plan_ref = btrim(v_provider_plan_ref), version = version + 1
  where id = new.subscription_id
    and restaurant_id = new.restaurant_id
    and provider = 'iyzico'
    and (provider_plan_ref is null or provider_plan_ref = btrim(v_provider_plan_ref));
  if not found then
    raise exception 'billing_subscription_provider_plan_conflict' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger sync_subscription_provider_plan_ref_from_checkout
  after insert or update on public.billing_provider_operations
  for each row execute function public.sync_subscription_provider_plan_ref_from_checkout();

create function public.claim_subscription_invoice_hydration(
  p_worker text,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_limit not between 1 and 100
    or p_lease_seconds not between 1 and 300 then
    raise exception 'billing_invoice_hydration_claim_invalid' using errcode = '22023';
  end if;

  with candidates as (
    select job.id
    from public.billing_reconciliation_jobs job
    join public.billing_provider_events event
      on job.dedupe_key = 'iyzico-event:' || event.provider_event_id
    where job.scope = 'provider_event'
      and job.discrepancy_code = 'provider_invoice_mapping_missing'
      and job.restaurant_id is not null
      and job.subscription_id is not null
      and job.scheduled_at <= clock_timestamp()
      and (
        job.status in ('pending', 'failed')
        or (job.status = 'running'
          and job.locked_at <= clock_timestamp() - make_interval(secs => p_lease_seconds))
      )
      and event.status in ('failed', 'processing')
    order by job.scheduled_at, job.created_at
    for update of job skip locked
    limit p_limit
  ), claimed as (
    update public.billing_reconciliation_jobs job
    set status = 'running',
        started_at = coalesce(job.started_at, clock_timestamp()),
        locked_at = clock_timestamp(),
        locked_by = btrim(p_worker),
        attempts = job.attempts + 1,
        last_error = null
    from candidates
    where job.id = candidates.id
    returning job.*
  ), events as (
    update public.billing_provider_events event
    set status = 'processing',
        locked_at = clock_timestamp(),
        locked_by = btrim(p_worker),
        last_error = null
    from claimed
    where claimed.dedupe_key = 'iyzico-event:' || event.provider_event_id
    returning event.*, claimed.id as job_id, claimed.attempts as hydration_attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', events.job_id,
    'providerEventId', events.id,
    'restaurantId', events.restaurant_id,
    'subscriptionId', events.subscription_id,
    'eventType', events.event_type,
    'providerCustomerRef', events.payload_sanitized->>'customerReferenceCode',
    'providerSubscriptionRef', events.payload_sanitized->>'subscriptionReferenceCode',
    'providerInvoiceRef', events.payload_sanitized->>'orderReferenceCode',
    'occurredAtEpochMs', events.payload_sanitized->'iyziEventTime',
    'attempts', events.hydration_attempts
  ) order by events.received_at), '[]'::jsonb)
  into v_result
  from events;
  return v_result;
end;
$$;

create function public.fail_subscription_invoice_hydration(
  p_job_id uuid,
  p_provider_event_id uuid,
  p_worker text,
  p_reason text,
  p_retry_delay_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_reason, ''))) not between 1 and 1000
    or p_retry_delay_seconds not between 1 and 3600 then
    raise exception 'billing_invoice_hydration_failure_invalid' using errcode = '22023';
  end if;
  update public.billing_reconciliation_jobs
  set status = 'failed',
      scheduled_at = clock_timestamp() + make_interval(secs => p_retry_delay_seconds),
      locked_at = null,
      locked_by = null,
      last_error = btrim(p_reason)
  where id = p_job_id and status = 'running' and locked_by = btrim(p_worker);
  if not found then return false; end if;
  update public.billing_provider_events
  set status = case when attempts + 1 >= 10 then 'dead_lettered' else 'failed' end,
      attempts = attempts + 1,
      available_at = clock_timestamp() + make_interval(secs => p_retry_delay_seconds),
      locked_at = null,
      locked_by = null,
      last_error = btrim(p_reason)
  where id = p_provider_event_id
    and status = 'processing'
    and locked_by = btrim(p_worker);
  return found;
end;
$$;

create function public.hydrate_subscription_invoice_from_provider_event(
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
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.billing_reconciliation_jobs%rowtype;
  v_event public.billing_provider_events%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_customer public.billing_customers%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_transition jsonb;
  v_expected_amount bigint;
  v_idempotency_key text;
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or coalesce(char_length(btrim(p_provider_customer_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_subscription_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_invoice_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_plan_ref)), 0) not between 1 and 200
    or p_plan not in ('starter', 'plus', 'pro')
    or p_billing_interval not in ('monthly', 'annual')
    or p_currency <> 'TRY'
    or p_amount_minor <= 0
    or p_period_end <= p_period_start
    or p_provider_order_status not in ('succeeded', 'failed') then
    raise exception 'billing_invoice_hydration_input_invalid' using errcode = '22023';
  end if;
  if p_add_ons is null
    or not (p_add_ons <@ array['iyzico_online_payments']::text[])
    or cardinality(p_add_ons) > 1
    or (cardinality(p_add_ons) > 0 and p_plan <> 'pro') then
    raise exception 'billing_invoice_hydration_add_ons_invalid' using errcode = '22023';
  end if;

  select * into v_job from public.billing_reconciliation_jobs
  where id = p_job_id for update;
  if not found or v_job.status <> 'running' or v_job.locked_by <> btrim(p_worker)
    or v_job.discrepancy_code <> 'provider_invoice_mapping_missing' then
    raise exception 'billing_invoice_hydration_lease_lost' using errcode = '55P03';
  end if;
  select * into v_event from public.billing_provider_events
  where id = p_provider_event_id for update;
  if not found or v_event.status <> 'processing' or v_event.locked_by <> btrim(p_worker)
    or v_event.restaurant_id is distinct from v_job.restaurant_id
    or v_event.subscription_id is distinct from v_job.subscription_id
    or v_event.payload_sanitized->>'customerReferenceCode' <> btrim(p_provider_customer_ref)
    or v_event.payload_sanitized->>'subscriptionReferenceCode' <> btrim(p_provider_subscription_ref)
    or v_event.payload_sanitized->>'orderReferenceCode' <> btrim(p_provider_invoice_ref)
    or (v_event.event_type = 'invoice.payment_succeeded' and p_provider_order_status <> 'succeeded')
    or (v_event.event_type = 'invoice.payment_failed' and p_provider_order_status <> 'failed') then
    raise exception 'billing_invoice_hydration_event_mismatch' using errcode = 'P0001';
  end if;

  select * into v_subscription from public.billing_subscriptions
  where id = v_event.subscription_id and restaurant_id = v_event.restaurant_id for update;
  if not found or v_subscription.provider <> 'iyzico'
    or v_subscription.provider_subscription_ref <> btrim(p_provider_subscription_ref)
    or v_subscription.provider_plan_ref is distinct from btrim(p_provider_plan_ref)
    or v_subscription.plan <> p_plan
    or v_subscription.billing_interval <> p_billing_interval then
    raise exception 'billing_invoice_hydration_subscription_mismatch' using errcode = 'P0001';
  end if;
  select * into v_customer from public.billing_customers
  where id = v_subscription.billing_customer_id for update;
  if not found or v_customer.provider_customer_ref <> btrim(p_provider_customer_ref) then
    raise exception 'billing_invoice_hydration_customer_mismatch' using errcode = 'P0001';
  end if;

  if cardinality(p_add_ons) = 0 then
    v_expected_amount := case p_plan || ':' || p_billing_interval
      when 'starter:monthly' then 41880 when 'starter:annual' then 402048
      when 'plus:monthly' then 83880 when 'plus:annual' then 805248
      when 'pro:monthly' then 143880 when 'pro:annual' then 1381248
      else null
    end;
  else
    select provider_gross_amount_minor into v_expected_amount
    from public.subscription_add_on_catalog
    where add_on = 'iyzico_online_payments'
      and billing_interval = p_billing_interval
      and provider_plan_ref = btrim(p_provider_plan_ref)
      and active = true;
    if not exists (
      select 1 from public.restaurant_subscription_add_ons add_on
      where add_on.restaurant_id = v_subscription.restaurant_id
        and add_on.subscription_id = v_subscription.id
        and add_on.add_on = 'iyzico_online_payments'
        and add_on.status = 'active'
    ) then
      raise exception 'billing_invoice_hydration_add_on_not_active' using errcode = 'P0001';
    end if;
  end if;
  if v_expected_amount is null or v_expected_amount <> p_amount_minor then
    raise exception 'billing_invoice_hydration_amount_mismatch' using errcode = 'P0001';
  end if;

  select * into v_invoice from public.subscription_invoices
  where provider = 'iyzico' and provider_invoice_ref = btrim(p_provider_invoice_ref)
  for update;
  if found then
    if v_invoice.restaurant_id <> v_subscription.restaurant_id
      or v_invoice.subscription_id <> v_subscription.id
      or v_invoice.amount_due_minor <> p_amount_minor
      or v_invoice.period_start <> p_period_start
      or v_invoice.period_end <> p_period_end then
      raise exception 'billing_invoice_hydration_invoice_conflict' using errcode = 'P0001';
    end if;
  else
    insert into public.subscription_invoices (
      restaurant_id, subscription_id, provider_invoice_ref, idempotency_key,
      plan, add_ons, billing_interval, amount_due_minor, status,
      period_start, period_end, due_at, finalized_at
    ) values (
      v_subscription.restaurant_id, v_subscription.id, btrim(p_provider_invoice_ref),
      'iyzico-renewal:' || v_event.id, p_plan, p_add_ons,
      p_billing_interval, p_amount_minor, 'open', p_period_start, p_period_end,
      p_period_start, p_occurred_at
    ) returning * into v_invoice;
  end if;

  update public.billing_provider_events
  set status = 'received', locked_at = null, locked_by = null, last_error = null
  where id = v_event.id;
  v_idempotency_key := 'iyzico-renewal:' || v_event.id;
  if v_event.event_type = 'invoice.payment_succeeded' then
    v_transition := public.record_subscription_payment_success_atomic(
      v_subscription.restaurant_id, v_subscription.id, v_invoice.id, v_event.id,
      btrim(p_provider_invoice_ref), p_amount_minor, p_occurred_at, v_idempotency_key
    );
    update public.billing_subscriptions
    set current_period_start = p_period_start,
        current_period_end = p_period_end,
        version = version + 1
    where id = v_subscription.id;
  else
    v_transition := public.record_subscription_payment_failure_atomic(
      v_subscription.restaurant_id, v_subscription.id, v_invoice.id, v_event.id,
      btrim(p_provider_invoice_ref), p_amount_minor,
      'provider_payment_failed', 'Provider reported a failed renewal payment',
      p_occurred_at, v_idempotency_key
    );
  end if;

  update public.billing_reconciliation_jobs
  set status = 'resolved', completed_at = p_occurred_at,
      locked_at = null, locked_by = null, discrepancy_code = null, last_error = null,
      local_snapshot = local_snapshot || jsonb_build_object('invoiceId', v_invoice.id)
  where id = v_job.id;

  return jsonb_build_object(
    'invoiceId', v_invoice.id,
    'invoiceStatus', v_transition->>'invoiceStatus',
    'subscriptionStatus', v_transition->>'subscriptionStatus',
    'eventType', v_event.event_type,
    'duplicate', coalesce((v_transition->>'duplicate')::boolean, false)
  );
end;
$$;

revoke all on function public.sync_subscription_provider_plan_ref_from_checkout()
  from public, anon, authenticated;
revoke all on function public.claim_subscription_invoice_hydration(text,integer,integer)
  from public, anon, authenticated;
revoke all on function public.fail_subscription_invoice_hydration(uuid,uuid,text,text,integer)
  from public, anon, authenticated;
revoke all on function public.hydrate_subscription_invoice_from_provider_event(
  uuid,uuid,text,text,text,text,text,text,text[],text,bigint,text,
  timestamptz,timestamptz,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_subscription_invoice_hydration(text,integer,integer)
  to service_role;
grant execute on function public.fail_subscription_invoice_hydration(uuid,uuid,text,text,integer)
  to service_role;
grant execute on function public.hydrate_subscription_invoice_from_provider_event(
  uuid,uuid,text,text,text,text,text,text,text[],text,bigint,text,
  timestamptz,timestamptz,text,timestamptz
) to service_role;

comment on function public.hydrate_subscription_invoice_from_provider_event(
  uuid,uuid,text,text,text,text,text,text,text[],text,bigint,text,
  timestamptz,timestamptz,text,timestamptz
) is 'Hydrates one authenticated iyzico recurring order and applies its signed event through the common payment transition.';

commit;
