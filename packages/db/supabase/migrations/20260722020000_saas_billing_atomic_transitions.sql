-- SaaS billing atomic transitions (ADR-0002/0003).
-- Aggregate state, lifecycle audit and durable outbox records commit together.
-- The functions are service-role only and accept already-verified provider
-- event inbox ids; raw webhook bodies never cross this boundary.

create unique index subscription_payment_attempts_one_success_per_invoice_idx
  on public.subscription_payment_attempts(invoice_id)
  where status = 'succeeded';

create or replace function public.create_subscription_invoice_atomic(
  p_restaurant_id uuid,
  p_subscription_id uuid,
  p_plan text,
  p_amount_minor bigint,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_due_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
  v_existing public.subscription_invoices%rowtype;
  v_invoice public.subscription_invoices%rowtype;
begin
  if p_plan not in ('starter', 'pro', 'enterprise')
    or p_amount_minor < 0
    or p_period_end <= p_period_start
    or char_length(btrim(p_idempotency_key)) not between 1 and 160 then
    raise exception 'billing_invoice_input_invalid' using errcode = '22023';
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where id = p_subscription_id
  for update;

  if not found or v_subscription.restaurant_id <> p_restaurant_id then
    raise exception 'billing_subscription_not_found' using errcode = 'P0002';
  end if;
  if v_subscription.status = 'cancelled' then
    raise exception 'billing_subscription_cancelled' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.subscription_invoices
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.subscription_id <> p_subscription_id
      or v_existing.plan <> p_plan
      or v_existing.currency <> 'TRY'
      or v_existing.amount_due_minor <> p_amount_minor
      or v_existing.period_start <> p_period_start
      or v_existing.period_end <> p_period_end
      or v_existing.due_at <> p_due_at then
      raise exception 'billing_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'invoiceId', v_existing.id,
      'status', v_existing.status,
      'duplicate', true
    );
  end if;

  insert into public.subscription_invoices (
    restaurant_id, subscription_id, idempotency_key, plan, currency,
    amount_due_minor, amount_paid_minor, status, period_start, period_end,
    due_at, finalized_at
  ) values (
    p_restaurant_id, p_subscription_id, p_idempotency_key, p_plan, 'TRY',
    p_amount_minor, 0, 'open', p_period_start, p_period_end,
    p_due_at, clock_timestamp()
  ) returning * into v_invoice;

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id,
    'billing_invoice',
    v_invoice.id,
    'invoice.created',
    jsonb_build_object(
      'subscriptionId', p_subscription_id,
      'amountMinor', p_amount_minor,
      'currency', 'TRY',
      'dueAt', p_due_at
    ),
    p_idempotency_key || ':outbox:created'
  );

  return jsonb_build_object(
    'invoiceId', v_invoice.id,
    'status', v_invoice.status,
    'duplicate', false
  );
end;
$$;

create or replace function public.record_subscription_payment_failure_atomic(
  p_restaurant_id uuid,
  p_subscription_id uuid,
  p_invoice_id uuid,
  p_provider_event_id uuid,
  p_provider_attempt_ref text,
  p_amount_minor bigint,
  p_failure_code text,
  p_failure_message text,
  p_occurred_at timestamptz,
  p_idempotency_key text
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
  v_existing_attempt public.subscription_payment_attempts%rowtype;
  v_attempt public.subscription_payment_attempts%rowtype;
  v_policy public.billing_platform_policies%rowtype;
  v_attempt_number integer;
  v_from_status text;
  v_to_status text;
begin
  if p_amount_minor < 0
    or char_length(btrim(p_idempotency_key)) not between 1 and 160
    or (p_failure_code is not null and char_length(p_failure_code) > 100)
    or (p_failure_message is not null and char_length(p_failure_message) > 500) then
    raise exception 'billing_payment_failure_input_invalid' using errcode = '22023';
  end if;

  select * into v_event
  from public.billing_provider_events
  where id = p_provider_event_id
  for update;

  if not found
    or v_event.restaurant_id is distinct from p_restaurant_id
    or v_event.subscription_id is distinct from p_subscription_id
    or v_event.event_type <> 'invoice.payment_failed' then
    raise exception 'billing_provider_event_mismatch' using errcode = 'P0001';
  end if;
  if v_event.status = 'dead_lettered' then
    raise exception 'billing_provider_event_dead_lettered' using errcode = 'P0001';
  end if;

  select * into v_invoice
  from public.subscription_invoices
  where id = p_invoice_id
  for update;
  if not found
    or v_invoice.restaurant_id <> p_restaurant_id
    or v_invoice.subscription_id <> p_subscription_id then
    raise exception 'billing_invoice_not_found' using errcode = 'P0002';
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where id = p_subscription_id
  for update;
  if not found or v_subscription.restaurant_id <> p_restaurant_id then
    raise exception 'billing_subscription_not_found' using errcode = 'P0002';
  end if;

  select * into v_existing_attempt
  from public.subscription_payment_attempts
  where idempotency_key = p_idempotency_key;

  if v_event.status = 'processed' or found then
    if found and (
      v_existing_attempt.restaurant_id <> p_restaurant_id
      or v_existing_attempt.invoice_id <> p_invoice_id
      or v_existing_attempt.amount_minor <> p_amount_minor
      or v_existing_attempt.status <> 'failed'
    ) then
      raise exception 'billing_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'invoiceId', v_invoice.id,
      'attemptId', v_existing_attempt.id,
      'invoiceStatus', v_invoice.status,
      'subscriptionStatus', v_subscription.status,
      'duplicate', true,
      'ignoredBecausePaid', v_invoice.status = 'paid'
    );
  end if;

  if v_invoice.amount_due_minor <> p_amount_minor then
    raise exception 'billing_amount_mismatch' using errcode = 'P0001';
  end if;

  if v_invoice.status = 'paid' then
    update public.billing_provider_events
    set status = 'processed', attempts = attempts + 1, processed_at = p_occurred_at,
        locked_at = null, locked_by = null, last_error = null
    where id = p_provider_event_id;
    return jsonb_build_object(
      'invoiceId', v_invoice.id,
      'attemptId', null,
      'invoiceStatus', 'paid',
      'subscriptionStatus', v_subscription.status,
      'duplicate', false,
      'ignoredBecausePaid', true
    );
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number
  from public.subscription_payment_attempts
  where invoice_id = p_invoice_id;

  insert into public.subscription_payment_attempts (
    restaurant_id, invoice_id, provider_attempt_ref, idempotency_key,
    attempt_number, currency, amount_minor, status, failure_code,
    failure_message, attempted_at, completed_at
  ) values (
    p_restaurant_id, p_invoice_id, nullif(btrim(p_provider_attempt_ref), ''),
    p_idempotency_key, v_attempt_number, 'TRY', p_amount_minor, 'failed',
    nullif(btrim(p_failure_code), ''), nullif(btrim(p_failure_message), ''),
    p_occurred_at, p_occurred_at
  ) returning * into v_attempt;

  update public.subscription_invoices
  set status = 'past_due', failed_at = p_occurred_at
  where id = p_invoice_id
  returning * into v_invoice;

  v_from_status := v_subscription.status;
  v_to_status := case when v_from_status = 'active' then 'past_due' else v_from_status end;
  if v_to_status <> v_from_status then
    update public.billing_subscriptions
    set status = v_to_status, version = version + 1
    where id = p_subscription_id
    returning * into v_subscription;

    insert into public.tenant_lifecycle_events (
      restaurant_id, subscription_id, from_status, to_status, actor_type,
      reason_code, reason_detail, request_id, metadata, occurred_at
    ) values (
      p_restaurant_id, p_subscription_id, v_from_status, v_to_status,
      'payment_provider', 'invoice_payment_failed', p_failure_message,
      p_idempotency_key || ':lifecycle',
      jsonb_build_object('invoiceId', p_invoice_id, 'attemptId', v_attempt.id),
      p_occurred_at
    );
  end if;

  if v_subscription.status not in ('cancelled', 'manual_hold') then
    select * into v_policy from public.billing_platform_policies where id = 'default';
    insert into public.dunning_runs (
      restaurant_id, subscription_id, invoice_id, policy_id, policy_snapshot,
      status, current_step, next_action_at
    ) values (
      p_restaurant_id, p_subscription_id, p_invoice_id, v_policy.id,
      jsonb_build_object(
        'trialDays', v_policy.trial_days,
        'preDueReminderDays', v_policy.pre_due_reminder_days,
        'retryAfterDays', v_policy.retry_after_days,
        'secondWarningAfterDays', v_policy.second_warning_after_days,
        'finalWarningAfterDays', v_policy.final_warning_after_days,
        'suspendAfterDays', v_policy.suspend_after_days,
        'cancelledRetentionDays', v_policy.cancelled_retention_days
      ),
      'scheduled', 'retry', p_occurred_at + make_interval(days => v_policy.retry_after_days)
    ) on conflict (invoice_id) do nothing;
  end if;

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id, 'billing_invoice', p_invoice_id, 'invoice.payment_failed',
    jsonb_build_object(
      'subscriptionId', p_subscription_id,
      'attemptId', v_attempt.id,
      'failureCode', nullif(btrim(p_failure_code), '')
    ),
    p_idempotency_key || ':outbox:failed'
  );

  if v_to_status <> v_from_status then
    perform public.enqueue_domain_outbox_event(
      p_restaurant_id, 'billing_subscription', p_subscription_id,
      'subscription.status_changed',
      jsonb_build_object('from', v_from_status, 'to', v_to_status, 'reasonCode', 'invoice_payment_failed'),
      p_idempotency_key || ':outbox:status'
    );
  end if;

  update public.billing_provider_events
  set status = 'processed', attempts = attempts + 1, processed_at = p_occurred_at,
      locked_at = null, locked_by = null, last_error = null
  where id = p_provider_event_id;

  return jsonb_build_object(
    'invoiceId', v_invoice.id,
    'attemptId', v_attempt.id,
    'invoiceStatus', v_invoice.status,
    'subscriptionStatus', v_subscription.status,
    'duplicate', false,
    'ignoredBecausePaid', false
  );
end;
$$;

create or replace function public.record_subscription_payment_success_atomic(
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
  v_event public.billing_provider_events%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_existing_attempt public.subscription_payment_attempts%rowtype;
  v_attempt public.subscription_payment_attempts%rowtype;
  v_attempt_number integer;
  v_from_status text;
  v_to_status text;
  v_reactivated boolean := false;
begin
  if p_amount_minor < 0
    or char_length(btrim(p_idempotency_key)) not between 1 and 160 then
    raise exception 'billing_payment_success_input_invalid' using errcode = '22023';
  end if;

  select * into v_event
  from public.billing_provider_events
  where id = p_provider_event_id
  for update;
  if not found
    or v_event.restaurant_id is distinct from p_restaurant_id
    or v_event.subscription_id is distinct from p_subscription_id
    or v_event.event_type <> 'invoice.payment_succeeded' then
    raise exception 'billing_provider_event_mismatch' using errcode = 'P0001';
  end if;
  if v_event.status = 'dead_lettered' then
    raise exception 'billing_provider_event_dead_lettered' using errcode = 'P0001';
  end if;

  select * into v_invoice
  from public.subscription_invoices
  where id = p_invoice_id
  for update;
  if not found
    or v_invoice.restaurant_id <> p_restaurant_id
    or v_invoice.subscription_id <> p_subscription_id then
    raise exception 'billing_invoice_not_found' using errcode = 'P0002';
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where id = p_subscription_id
  for update;
  if not found or v_subscription.restaurant_id <> p_restaurant_id then
    raise exception 'billing_subscription_not_found' using errcode = 'P0002';
  end if;

  if v_invoice.amount_due_minor <> p_amount_minor then
    raise exception 'billing_amount_mismatch' using errcode = 'P0001';
  end if;

  select * into v_existing_attempt
  from public.subscription_payment_attempts
  where idempotency_key = p_idempotency_key;
  if found and (
    v_existing_attempt.restaurant_id <> p_restaurant_id
    or v_existing_attempt.invoice_id <> p_invoice_id
    or v_existing_attempt.amount_minor <> p_amount_minor
    or v_existing_attempt.status <> 'succeeded'
  ) then
    raise exception 'billing_idempotency_conflict' using errcode = 'P0001';
  end if;

  if v_event.status = 'processed' or v_invoice.status = 'paid' or found then
    if v_event.status <> 'processed' then
      update public.billing_provider_events
      set status = 'processed', attempts = attempts + 1, processed_at = p_occurred_at,
          locked_at = null, locked_by = null, last_error = null
      where id = p_provider_event_id;
    end if;
    if v_existing_attempt.id is null then
      select * into v_existing_attempt
      from public.subscription_payment_attempts
      where invoice_id = p_invoice_id and status = 'succeeded';
    end if;
    return jsonb_build_object(
      'invoiceId', v_invoice.id,
      'attemptId', v_existing_attempt.id,
      'invoiceStatus', 'paid',
      'subscriptionStatus', v_subscription.status,
      'duplicate', true,
      'reactivated', false
    );
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number
  from public.subscription_payment_attempts
  where invoice_id = p_invoice_id;

  insert into public.subscription_payment_attempts (
    restaurant_id, invoice_id, provider_attempt_ref, idempotency_key,
    attempt_number, currency, amount_minor, status, attempted_at, completed_at
  ) values (
    p_restaurant_id, p_invoice_id, nullif(btrim(p_provider_attempt_ref), ''),
    p_idempotency_key, v_attempt_number, 'TRY', p_amount_minor, 'succeeded',
    p_occurred_at, p_occurred_at
  ) returning * into v_attempt;

  update public.subscription_invoices
  set status = 'paid', amount_paid_minor = amount_due_minor, paid_at = p_occurred_at
  where id = p_invoice_id
  returning * into v_invoice;

  update public.dunning_runs
  set status = 'stopped', next_action_at = null, last_action_at = p_occurred_at
  where invoice_id = p_invoice_id and status <> 'stopped';

  v_from_status := v_subscription.status;
  -- A provider callback must never override an explicit platform-admin hold.
  v_to_status := case
    when v_from_status in ('manual_hold', 'cancelled') then v_from_status
    else 'active'
  end;
  v_reactivated := v_from_status = 'suspended' and v_to_status = 'active';

  if v_to_status <> v_from_status then
    update public.billing_subscriptions
    set status = v_to_status, plan = v_invoice.plan, scheduled_plan = null,
        grace_ends_at = null, suspended_at = null, version = version + 1
    where id = p_subscription_id
    returning * into v_subscription;

    insert into public.tenant_lifecycle_events (
      restaurant_id, subscription_id, from_status, to_status, actor_type,
      reason_code, request_id, metadata, occurred_at
    ) values (
      p_restaurant_id, p_subscription_id, v_from_status, v_to_status,
      'payment_provider', 'invoice_paid', p_idempotency_key || ':lifecycle',
      jsonb_build_object('invoiceId', p_invoice_id, 'attemptId', v_attempt.id),
      p_occurred_at
    );
  elsif v_to_status = 'active' then
    update public.billing_subscriptions
    set plan = v_invoice.plan, scheduled_plan = null, version = version + 1
    where id = p_subscription_id
    returning * into v_subscription;
  end if;

  if v_to_status = 'active' then
    update public.restaurants set plan = v_invoice.plan where id = p_restaurant_id;
  end if;

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id, 'billing_invoice', p_invoice_id, 'invoice.paid',
    jsonb_build_object(
      'subscriptionId', p_subscription_id,
      'amountMinor', p_amount_minor,
      'currency', 'TRY',
      'paidAt', p_occurred_at
    ),
    p_idempotency_key || ':outbox:paid'
  );

  if v_to_status <> v_from_status then
    perform public.enqueue_domain_outbox_event(
      p_restaurant_id, 'billing_subscription', p_subscription_id,
      'subscription.status_changed',
      jsonb_build_object('from', v_from_status, 'to', v_to_status, 'reasonCode', 'invoice_paid'),
      p_idempotency_key || ':outbox:status'
    );
  end if;

  if v_reactivated then
    perform public.enqueue_domain_outbox_event(
      p_restaurant_id, 'billing_subscription', p_subscription_id,
      'tenant.reactivated', jsonb_build_object('reasonCode', 'invoice_paid'),
      p_idempotency_key || ':outbox:reactivated'
    );
  end if;

  update public.billing_provider_events
  set status = 'processed', attempts = attempts + 1, processed_at = p_occurred_at,
      locked_at = null, locked_by = null, last_error = null
  where id = p_provider_event_id;

  return jsonb_build_object(
    'invoiceId', v_invoice.id,
    'attemptId', v_attempt.id,
    'invoiceStatus', v_invoice.status,
    'subscriptionStatus', v_subscription.status,
    'duplicate', false,
    'reactivated', v_reactivated
  );
end;
$$;

revoke all on function public.create_subscription_invoice_atomic(uuid, uuid, text, bigint, timestamptz, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.record_subscription_payment_failure_atomic(uuid, uuid, uuid, uuid, text, bigint, text, text, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.record_subscription_payment_success_atomic(uuid, uuid, uuid, uuid, text, bigint, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.create_subscription_invoice_atomic(uuid, uuid, text, bigint, timestamptz, timestamptz, timestamptz, text)
  to service_role;
grant execute on function public.record_subscription_payment_failure_atomic(uuid, uuid, uuid, uuid, text, bigint, text, text, timestamptz, text)
  to service_role;
grant execute on function public.record_subscription_payment_success_atomic(uuid, uuid, uuid, uuid, text, bigint, timestamptz, text)
  to service_role;

comment on function public.create_subscription_invoice_atomic(uuid, uuid, text, bigint, timestamptz, timestamptz, timestamptz, text)
  is 'Creates one recurring SaaS invoice and invoice.created outbox event atomically.';
comment on function public.record_subscription_payment_failure_atomic(uuid, uuid, uuid, uuid, text, bigint, text, text, timestamptz, text)
  is 'Records an idempotent SaaS payment failure, dunning schedule, lifecycle audit and outbox events atomically.';
comment on function public.record_subscription_payment_success_atomic(uuid, uuid, uuid, uuid, text, bigint, timestamptz, text)
  is 'Records first-success-wins SaaS payment, entitlement projection, lifecycle audit and outbox events atomically.';
