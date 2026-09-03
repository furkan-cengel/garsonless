-- Phase 3b: converge an iyzico NEXT_PERIOD plan change on authenticated paid
-- renewal evidence. Provider acceptance only creates a scheduled child
-- reference; this migration makes that child usable by the webhook/hydration
-- path without granting the target plan before its invoice is paid.

begin;

alter table public.subscription_change_requests
  drop constraint if exists subscription_change_requests_status_check;
alter table public.subscription_change_requests
  add constraint subscription_change_requests_status_check check (status in (
    'processing', 'scheduled', 'paid_pending', 'paid_draining', 'applied',
    'cancelled', 'requires_reconciliation', 'failed'
  )),
  add column paid_invoice_id uuid,
  add column paid_at timestamptz,
  add constraint subscription_change_requests_paid_invoice_fk
    foreign key (restaurant_id, paid_invoice_id)
    references public.subscription_invoices(restaurant_id, id) on delete restrict,
  add constraint subscription_change_requests_paid_evidence_check check (
    (paid_invoice_id is null) = (paid_at is null)
  );

drop index public.subscription_change_requests_one_live_idx;
create unique index subscription_change_requests_one_live_idx
  on public.subscription_change_requests(subscription_id)
  where status in (
    'processing', 'scheduled', 'paid_pending', 'paid_draining',
    'requires_reconciliation'
  );
drop index public.subscription_change_requests_due_idx;
create index subscription_change_requests_due_idx
  on public.subscription_change_requests(status, effective_at)
  where status in ('scheduled', 'paid_pending', 'paid_draining');

-- A succeeded provider operation remains valid while its paid change waits for
-- a manual hold to lift or for open adisyonlar to drain.
create or replace function public.assert_succeeded_plan_change_is_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.operation_type = 'subscription.change' and new.status = 'succeeded'
    and not exists (
      select 1 from public.subscription_change_requests request
      where request.id = new.change_request_id
        and request.provider_operation_id = new.id
        and request.status in ('scheduled', 'paid_pending', 'paid_draining', 'applied')
    ) then
    raise exception 'billing_plan_change_schedule_invariant_broken' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Resolve both the canonical reference and an exact scheduled child. Retired
-- parent references stay attributable for reconciliation but are never
-- automatically hydrated into a new invoice.
create or replace function public.ingest_subscription_billing_provider_event(
  p_provider_event_id text,
  p_event_type text,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_invoice_ref text,
  p_payload_sanitized jsonb,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.billing_provider_events%rowtype;
  v_provider_ref public.billing_subscription_provider_refs%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_customer public.billing_customers%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_duplicate boolean := false;
  v_reason text;
begin
  if char_length(btrim(p_provider_event_id)) not between 1 and 200
    or p_event_type not in ('invoice.payment_succeeded', 'invoice.payment_failed')
    or char_length(btrim(p_provider_subscription_ref)) not between 1 and 200
    or char_length(btrim(p_provider_invoice_ref)) not between 1 and 200
    or char_length(btrim(p_payload_hash)) not between 1 and 200
    or jsonb_typeof(p_payload_sanitized) <> 'object'
    or pg_column_size(p_payload_sanitized) > 65536 then
    raise exception 'billing_provider_event_input_invalid' using errcode = '22023';
  end if;

  select * into v_provider_ref
  from public.billing_subscription_provider_refs provider_ref
  where provider_ref.provider = 'iyzico'
    and provider_ref.provider_subscription_ref = btrim(p_provider_subscription_ref);

  if found then
    select * into v_subscription
    from public.billing_subscriptions subscription
    where subscription.id = v_provider_ref.subscription_id
      and subscription.restaurant_id = v_provider_ref.restaurant_id
      and subscription.provider = 'iyzico';
  end if;

  if v_subscription.id is not null then
    select * into v_customer
    from public.billing_customers customer
    where customer.id = v_subscription.billing_customer_id;

    if v_provider_ref.ref_role = 'previous' then
      v_reason := 'provider_subscription_reference_retired';
    elsif p_provider_customer_ref is not null
      and btrim(p_provider_customer_ref) <> ''
      and v_customer.provider_customer_ref is distinct from p_provider_customer_ref then
      v_reason := 'provider_customer_reference_mismatch';
    else
      select * into v_invoice
      from public.subscription_invoices invoice
      where invoice.subscription_id = v_subscription.id
        and invoice.provider = 'iyzico'
        and invoice.provider_invoice_ref = p_provider_invoice_ref;
      if not found then
        v_reason := 'provider_invoice_mapping_missing';
      end if;
    end if;
  else
    v_reason := 'provider_subscription_mapping_missing';
  end if;

  insert into public.billing_provider_events (
    provider, provider_event_id, event_type, restaurant_id, subscription_id,
    payload_sanitized, payload_hash, status, last_error, available_at
  ) values (
    'iyzico', btrim(p_provider_event_id), p_event_type,
    v_subscription.restaurant_id, v_subscription.id,
    p_payload_sanitized, btrim(p_payload_hash),
    case when v_reason is null then 'received' else 'failed' end,
    v_reason, clock_timestamp()
  )
  on conflict (provider, provider_event_id) do nothing
  returning * into v_event;

  if not found then
    v_duplicate := true;
    select * into v_event
    from public.billing_provider_events
    where provider = 'iyzico' and provider_event_id = btrim(p_provider_event_id)
    for update;

    if v_event.event_type <> p_event_type or v_event.payload_hash <> btrim(p_payload_hash) then
      raise exception 'billing_provider_event_idempotency_conflict' using errcode = 'P0001';
    end if;

    if v_event.status <> 'processed' and v_reason is null then
      update public.billing_provider_events
      set restaurant_id = v_subscription.restaurant_id,
          subscription_id = v_subscription.id,
          status = 'received',
          last_error = null,
          available_at = clock_timestamp()
      where id = v_event.id
      returning * into v_event;
    end if;
  end if;

  if v_reason is not null and v_event.status <> 'processed' then
    insert into public.billing_reconciliation_jobs (
      restaurant_id, subscription_id, provider, scope, dedupe_key, status,
      scheduled_at, local_snapshot, provider_snapshot_sanitized,
      discrepancy_code, last_error
    ) values (
      v_subscription.restaurant_id, v_subscription.id, 'iyzico', 'provider_event',
      'iyzico-event:' || btrim(p_provider_event_id), 'pending', clock_timestamp(),
      jsonb_strip_nulls(jsonb_build_object(
        'invoiceId', v_invoice.id,
        'providerInvoiceRef', p_provider_invoice_ref,
        'providerReferenceRole', v_provider_ref.ref_role
      )),
      p_payload_sanitized, v_reason, v_reason
    )
    on conflict (dedupe_key) do update
    set status = case
          when public.billing_reconciliation_jobs.status = 'resolved' then 'resolved'
          else 'pending'
        end,
        scheduled_at = clock_timestamp(),
        local_snapshot = excluded.local_snapshot,
        provider_snapshot_sanitized = excluded.provider_snapshot_sanitized,
        discrepancy_code = excluded.discrepancy_code,
        last_error = excluded.last_error;
  end if;

  return jsonb_build_object(
    'providerEventId', v_event.id,
    'restaurantId', v_subscription.restaurant_id,
    'subscriptionId', v_subscription.id,
    'invoiceId', v_invoice.id,
    'amountMinor', v_invoice.amount_due_minor,
    'currency', case when v_invoice.id is null then null else v_invoice.currency end,
    'duplicate', v_duplicate,
    'dispatchable', v_reason is null and v_event.status <> 'processed',
    'alreadyProcessed', v_event.status = 'processed'
  );
end;
$$;

-- Called in the same database transaction as first-success-wins payment. The
-- invoice and provider event are both locked and exact-bound before either the
-- canonical provider lineage or tenant entitlements can move.
create function public.converge_paid_subscription_plan_change(
  p_restaurant_id uuid,
  p_subscription_id uuid,
  p_invoice_id uuid,
  p_provider_event_id uuid,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.billing_provider_events%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_change public.subscription_change_requests%rowtype;
  v_provider_ref public.billing_subscription_provider_refs%rowtype;
  v_provider_subscription_ref text;
  v_expected_period_start timestamptz;
  v_is_downgrade boolean;
  v_open_session_count integer := 0;
  v_result_status text;
begin
  select * into v_event from public.billing_provider_events
  where id = p_provider_event_id for update;
  select * into v_invoice from public.subscription_invoices
  where id = p_invoice_id and restaurant_id = p_restaurant_id
    and subscription_id = p_subscription_id for update;
  select * into v_subscription from public.billing_subscriptions
  where id = p_subscription_id and restaurant_id = p_restaurant_id for update;
  if v_event.id is null or v_invoice.id is null or v_subscription.id is null
    or v_event.restaurant_id is distinct from p_restaurant_id
    or v_event.subscription_id is distinct from p_subscription_id then
    raise exception 'billing_plan_change_payment_context_invalid' using errcode = 'P0001';
  end if;

  v_provider_subscription_ref := v_event.payload_sanitized->>'subscriptionReferenceCode';
  if coalesce(char_length(btrim(v_provider_subscription_ref)), 0) not between 1 and 200 then
    return jsonb_build_object('status', 'not_applicable', 'duplicate', false);
  end if;

  select * into v_change
  from public.subscription_change_requests request
  where request.restaurant_id = p_restaurant_id
    and request.subscription_id = p_subscription_id
    and request.provider_target_subscription_ref = btrim(v_provider_subscription_ref)
    and request.status in ('scheduled', 'paid_pending', 'paid_draining', 'applied')
  order by request.created_at desc
  limit 1
  for update;
  if not found then
    return jsonb_build_object('status', 'not_applicable', 'duplicate', false);
  end if;

  if v_change.status = 'applied' then
    if v_change.paid_invoice_id = p_invoice_id then
      return jsonb_build_object(
        'changeRequestId', v_change.id, 'status', 'applied', 'duplicate', true
      );
    end if;
    return jsonb_build_object('status', 'not_applicable', 'duplicate', false);
  end if;
  if v_change.status in ('paid_pending', 'paid_draining') then
    if v_change.paid_invoice_id <> p_invoice_id then
      raise exception 'billing_plan_change_paid_invoice_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'changeRequestId', v_change.id, 'status', v_change.status, 'duplicate', true
    );
  end if;

  v_expected_period_start := (v_change.provider_result_sanitized->>'providerPeriodStart')::timestamptz;
  select * into v_provider_ref
  from public.billing_subscription_provider_refs provider_ref
  where provider_ref.provider = 'iyzico'
    and provider_ref.provider_subscription_ref = btrim(v_provider_subscription_ref)
    and provider_ref.restaurant_id = p_restaurant_id
    and provider_ref.subscription_id = p_subscription_id
  for update;
  if v_provider_ref.provider_subscription_ref is null
    or v_provider_ref.ref_role <> 'scheduled'
    or v_provider_ref.provider_plan_ref is distinct from v_change.provider_target_plan_ref
    or v_invoice.status <> 'paid'
    or v_invoice.amount_paid_minor <> v_invoice.amount_due_minor
    or v_invoice.plan <> v_change.to_plan
    or v_invoice.billing_interval <> v_change.to_billing_interval
    or v_invoice.add_ons <> v_change.to_add_ons
    or v_invoice.period_start is distinct from v_expected_period_start
    or v_change.effective_policy <> 'next_period'
    or v_change.paid_invoice_id is not null then
    raise exception 'billing_plan_change_payment_evidence_mismatch' using errcode = 'P0001';
  end if;

  v_is_downgrade := (
    case v_change.to_plan when 'starter' then 0 when 'plus' then 1 else 2 end
    < case v_change.from_plan when 'starter' then 0 when 'plus' then 1 else 2 end
  );
  if v_is_downgrade then
    select count(*)::integer into v_open_session_count
    from public.table_sessions session
    where session.restaurant_id = p_restaurant_id and session.closed_at is null;
  end if;

  if v_subscription.status <> 'active' then
    v_result_status := 'paid_pending';
  elsif v_is_downgrade and v_open_session_count > 0 then
    v_result_status := 'paid_draining';
  else
    v_result_status := 'applied';
  end if;

  if v_result_status = 'applied' then
    update public.billing_subscriptions
    set provider_subscription_ref = v_change.provider_target_subscription_ref,
        provider_plan_ref = v_change.provider_target_plan_ref,
        plan = v_change.to_plan,
        scheduled_plan = null,
        billing_interval = v_change.to_billing_interval,
        version = version + 1
    where id = p_subscription_id;
    update public.restaurants set plan = v_change.to_plan where id = p_restaurant_id;
  else
    -- record_subscription_payment_success_atomic may already have projected the
    -- invoice plan. Restore the prior entitlement inside this transaction.
    update public.billing_subscriptions
    set provider_subscription_ref = v_change.provider_target_subscription_ref,
        provider_plan_ref = v_change.provider_target_plan_ref,
        plan = v_change.from_plan,
        scheduled_plan = v_change.to_plan,
        billing_interval = v_change.to_billing_interval,
        version = version + 1
    where id = p_subscription_id;
    update public.restaurants set plan = v_change.from_plan where id = p_restaurant_id;
  end if;

  update public.subscription_change_requests
  set status = v_result_status,
      paid_invoice_id = p_invoice_id,
      paid_at = p_occurred_at,
      applied_at = case when v_result_status = 'applied' then p_occurred_at else null end,
      last_error = null
  where id = v_change.id;

  if v_result_status = 'applied' then
    perform public.enqueue_domain_outbox_event(
      p_restaurant_id, 'billing_subscription', v_change.id, 'plan.changed',
      jsonb_build_object(
        'subscriptionId', p_subscription_id,
        'changeRequestId', v_change.id,
        'invoiceId', p_invoice_id,
        'fromPlan', v_change.from_plan,
        'toPlan', v_change.to_plan,
        'billingInterval', v_change.to_billing_interval,
        'effectiveAt', v_change.effective_at,
        'appliedAt', p_occurred_at,
        'semanticVersion', 1
      ),
      'billing:plan-changed:v1:' || v_change.id
    );
  end if;

  return jsonb_build_object(
    'changeRequestId', v_change.id,
    'status', v_result_status,
    'openSessionCount', v_open_session_count,
    'duplicate', false
  );
end;
$$;

create function public.record_subscription_payment_success_with_plan_change_atomic(
  p_restaurant_id uuid,
  p_subscription_id uuid,
  p_invoice_id uuid,
  p_provider_event_id uuid,
  p_provider_attempt_ref text,
  p_amount_minor bigint,
  p_occurred_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment jsonb;
  v_change jsonb;
begin
  v_payment := public.record_subscription_payment_success_atomic(
    p_restaurant_id, p_subscription_id, p_invoice_id, p_provider_event_id,
    p_provider_attempt_ref, p_amount_minor, p_occurred_at, p_idempotency_key
  );
  v_change := public.converge_paid_subscription_plan_change(
    p_restaurant_id, p_subscription_id, p_invoice_id, p_provider_event_id, p_occurred_at
  );
  return v_payment || jsonb_build_object('planChange', v_change);
end;
$$;

-- A paid downgrade remains on the previous entitlement while open sessions
-- drain. This bounded worker applies it once, without provider calls.
create function public.apply_paid_subscription_plan_changes(
  p_limit integer default 20,
  p_occurred_at timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_change public.subscription_change_requests%rowtype;
  v_applied integer := 0;
begin
  if p_limit not between 1 and 100 or p_occurred_at is null then
    raise exception 'billing_paid_plan_change_apply_input_invalid' using errcode = '22023';
  end if;

  for v_change in
    select request.*
    from public.subscription_change_requests request
    join public.billing_subscriptions subscription
      on subscription.id = request.subscription_id
      and subscription.restaurant_id = request.restaurant_id
    join public.subscription_invoices invoice
      on invoice.id = request.paid_invoice_id
      and invoice.restaurant_id = request.restaurant_id
      and invoice.subscription_id = request.subscription_id
    where request.status in ('paid_pending', 'paid_draining')
      and request.paid_at is not null
      and request.effective_at <= p_occurred_at
      and subscription.status = 'active'
      and subscription.provider_subscription_ref = request.provider_target_subscription_ref
      and subscription.provider_plan_ref = request.provider_target_plan_ref
      and invoice.status = 'paid'
      and invoice.amount_paid_minor = invoice.amount_due_minor
      and not exists (
        select 1 from public.table_sessions session
        where session.restaurant_id = request.restaurant_id
          and session.closed_at is null
          and case request.to_plan when 'starter' then 0 when 'plus' then 1 else 2 end
            < case request.from_plan when 'starter' then 0 when 'plus' then 1 else 2 end
      )
    order by request.effective_at, request.created_at
    for update of request, subscription skip locked
    limit p_limit
  loop
    update public.billing_subscriptions
    set plan = v_change.to_plan,
        scheduled_plan = null,
        billing_interval = v_change.to_billing_interval,
        version = version + 1
    where id = v_change.subscription_id
      and restaurant_id = v_change.restaurant_id;
    update public.restaurants set plan = v_change.to_plan where id = v_change.restaurant_id;
    update public.subscription_change_requests
    set status = 'applied', applied_at = p_occurred_at, last_error = null
    where id = v_change.id;
    perform public.enqueue_domain_outbox_event(
      v_change.restaurant_id, 'billing_subscription', v_change.id, 'plan.changed',
      jsonb_build_object(
        'subscriptionId', v_change.subscription_id,
        'changeRequestId', v_change.id,
        'invoiceId', v_change.paid_invoice_id,
        'fromPlan', v_change.from_plan,
        'toPlan', v_change.to_plan,
        'billingInterval', v_change.to_billing_interval,
        'effectiveAt', v_change.effective_at,
        'appliedAt', p_occurred_at,
        'semanticVersion', 1
      ),
      'billing:plan-changed:v1:' || v_change.id
    );
    v_applied := v_applied + 1;
  end loop;
  return v_applied;
end;
$$;

-- Same lease and exact provider order contract as Phase 2, extended only for
-- the scheduled/current child reference recorded by the change ledger.
create or replace function public.hydrate_subscription_invoice_from_provider_event(
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
  v_provider_ref public.billing_subscription_provider_refs%rowtype;
  v_change public.subscription_change_requests%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_transition jsonb;
  v_expected_amount bigint;
  v_idempotency_key text;
  v_current_binding boolean := false;
  v_change_binding boolean := false;
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
  select * into v_provider_ref from public.billing_subscription_provider_refs
  where provider = 'iyzico'
    and provider_subscription_ref = btrim(p_provider_subscription_ref)
    and subscription_id = v_subscription.id
    and restaurant_id = v_subscription.restaurant_id
  for update;
  select * into v_change from public.subscription_change_requests request
  where request.subscription_id = v_subscription.id
    and request.restaurant_id = v_subscription.restaurant_id
    and request.provider_target_subscription_ref = btrim(p_provider_subscription_ref)
    and request.provider_target_plan_ref = btrim(p_provider_plan_ref)
    and request.status in ('scheduled', 'paid_pending', 'paid_draining')
  order by request.created_at desc limit 1 for update;

  v_current_binding := v_provider_ref.ref_role = 'current'
    and v_subscription.provider_subscription_ref = btrim(p_provider_subscription_ref)
    and v_subscription.provider_plan_ref is not distinct from btrim(p_provider_plan_ref)
    and v_subscription.plan = p_plan
    and v_subscription.billing_interval = p_billing_interval;
  v_change_binding := v_change.id is not null
    and v_provider_ref.ref_role in ('scheduled', 'current')
    and v_change.to_plan = p_plan
    and v_change.to_billing_interval = p_billing_interval
    and v_change.to_add_ons = p_add_ons
    and (v_change.provider_result_sanitized->>'providerPeriodStart')::timestamptz = p_period_start;

  if v_subscription.id is null or v_subscription.provider <> 'iyzico'
    or v_provider_ref.provider_subscription_ref is null
    or not (v_current_binding or v_change_binding) then
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
      or v_invoice.plan <> p_plan
      or v_invoice.add_ons <> p_add_ons
      or v_invoice.billing_interval <> p_billing_interval
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
    v_transition := public.record_subscription_payment_success_with_plan_change_atomic(
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

revoke all on function public.converge_paid_subscription_plan_change(
  uuid,uuid,uuid,uuid,timestamptz
) from public, anon, authenticated;
revoke all on function public.record_subscription_payment_success_with_plan_change_atomic(
  uuid,uuid,uuid,uuid,text,bigint,timestamptz,text
) from public, anon, authenticated;
revoke all on function public.apply_paid_subscription_plan_changes(integer,timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_subscription_payment_success_with_plan_change_atomic(
  uuid,uuid,uuid,uuid,text,bigint,timestamptz,text
) to service_role;
grant execute on function public.apply_paid_subscription_plan_changes(integer,timestamptz)
  to service_role;

comment on function public.record_subscription_payment_success_with_plan_change_atomic(
  uuid,uuid,uuid,uuid,text,bigint,timestamptz,text
) is 'Records first-success-wins payment and applies an exact scheduled plan change in the same transaction.';
comment on function public.apply_paid_subscription_plan_changes(integer,timestamptz)
  is 'Applies paid plan changes after manual holds or open-session downgrade drains clear.';

commit;
