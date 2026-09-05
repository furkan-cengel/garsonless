-- Phase 5a: owner-default period-end cancellation, reversible until due.
-- Provider cancellation is dispatched only by the leased maintenance worker.

begin;

alter table public.domain_outbox drop constraint if exists domain_outbox_event_type_check;
alter table public.domain_outbox add constraint domain_outbox_event_type_check
  check (event_type in (
    'order.created', 'order.status_changed', 'order.settled',
    'table_session.closed', 'service_request.created',
    'customer.welcome_bonus_requested', 'campaign.delivery_requested',
    'subscription.trial_started', 'subscription.status_changed',
    'subscription.cancellation_scheduled', 'subscription.cancellation_withdrawn',
    'subscription.cancelled',
    'invoice.created', 'invoice.upcoming', 'invoice.payment_failed', 'invoice.paid',
    'billing.retry_requested', 'billing.warning_3', 'billing.warning_7',
    'billing.reconciliation_required',
    'plan.change_scheduled', 'plan.changed', 'payment_method.updated',
    'tenant.suspended', 'tenant.reactivated'
  ));

create table public.subscription_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid not null,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  status text not null check (status in (
    'scheduled', 'processing', 'applied', 'withdrawn', 'requires_reconciliation'
  )),
  effective_at timestamptz not null,
  provider_operation_id uuid unique,
  provider_subscription_ref text not null
    check (char_length(btrim(provider_subscription_ref)) between 1 and 200),
  idempotency_key text not null unique
    check (char_length(btrim(idempotency_key)) between 1 and 160),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  requested_by uuid not null references auth.users(id) on delete restrict,
  withdrawal_idempotency_key text unique
    check (withdrawal_idempotency_key is null or char_length(btrim(withdrawal_idempotency_key)) between 1 and 160),
  withdrawal_request_fingerprint text
    check (withdrawal_request_fingerprint is null or withdrawal_request_fingerprint ~ '^[a-f0-9]{64}$'),
  withdrawn_by uuid references auth.users(id) on delete restrict,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text check (locked_by is null or char_length(btrim(locked_by)) between 1 and 160),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  scheduled_at timestamptz not null,
  applied_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, subscription_id, id),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  foreign key (provider_operation_id)
    references public.billing_provider_operations(id) on delete set null,
  check (
    (status = 'scheduled' and locked_at is null and locked_by is null
      and applied_at is null and withdrawn_at is null)
    or (status = 'processing' and locked_at is not null and locked_by is not null
      and provider_operation_id is not null and applied_at is null and withdrawn_at is null)
    or (status = 'applied' and applied_at is not null and withdrawn_at is null)
    or (status = 'withdrawn' and withdrawn_at is not null and withdrawn_by is not null
      and withdrawal_idempotency_key is not null and withdrawal_request_fingerprint is not null
      and applied_at is null)
    or (status = 'requires_reconciliation' and applied_at is null and withdrawn_at is null)
  )
);

create unique index subscription_cancellation_requests_one_live_idx
  on public.subscription_cancellation_requests(subscription_id)
  where status in ('scheduled', 'processing', 'requires_reconciliation');
create index subscription_cancellation_requests_due_idx
  on public.subscription_cancellation_requests(effective_at, next_attempt_at, created_at)
  where status = 'scheduled';

create trigger subscription_cancellation_requests_updated_at
  before update on public.subscription_cancellation_requests
  for each row execute function public.update_updated_at();

alter table public.subscription_cancellation_requests enable row level security;
alter table public.subscription_cancellation_requests force row level security;
revoke all on table public.subscription_cancellation_requests from public, anon, authenticated;
grant select, insert, update on table public.subscription_cancellation_requests to service_role;

create function public.reject_subscription_change_during_scheduled_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('processing', 'scheduled', 'paid_pending', 'paid_draining', 'requires_reconciliation')
    and exists (
      select 1 from public.subscription_cancellation_requests cancellation
      where cancellation.subscription_id = new.subscription_id
        and cancellation.restaurant_id = new.restaurant_id
        and cancellation.status in ('scheduled', 'processing', 'requires_reconciliation')
    ) then
    raise exception 'billing_cancellation_already_pending' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger reject_subscription_change_during_scheduled_cancellation
  before insert or update of status on public.subscription_change_requests
  for each row execute function public.reject_subscription_change_during_scheduled_cancellation();

create function public.schedule_subscription_cancellation(
  p_restaurant_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_requested_by uuid,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.subscription_cancellation_requests%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_request public.subscription_cancellation_requests%rowtype;
begin
  if p_restaurant_id is null or p_requested_by is null or p_occurred_at is null
    or char_length(btrim(coalesce(p_idempotency_key, ''))) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'billing_cancellation_schedule_input_invalid' using errcode = '22023';
  end if;

  select * into v_existing from public.subscription_cancellation_requests
  where idempotency_key = btrim(p_idempotency_key) for update;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.request_fingerprint <> p_request_fingerprint
      or v_existing.requested_by <> p_requested_by then
      raise exception 'billing_cancellation_schedule_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'cancellationRequestId', v_existing.id,
      'subscriptionId', v_existing.subscription_id,
      'status', v_existing.status,
      'effectiveAt', v_existing.effective_at,
      'duplicate', true
    );
  end if;

  select * into v_subscription from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled' for update;
  if not found or v_subscription.provider <> 'iyzico'
    or v_subscription.provider_subscription_ref is null
    or v_subscription.status not in ('active', 'past_due', 'grace_period')
    or v_subscription.current_period_end is null
    or v_subscription.current_period_end <= p_occurred_at
    or v_subscription.cancel_at_period_end then
    raise exception 'billing_cancellation_subscription_not_eligible' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.subscription_change_requests change
    where change.subscription_id = v_subscription.id
      and change.status in ('processing', 'scheduled', 'paid_pending', 'paid_draining', 'requires_reconciliation')
  ) then
    raise exception 'billing_plan_change_already_pending' using errcode = '55000';
  end if;

  insert into public.subscription_cancellation_requests (
    restaurant_id, subscription_id, status, effective_at,
    provider_subscription_ref, idempotency_key, request_fingerprint,
    requested_by, scheduled_at, next_attempt_at
  ) values (
    p_restaurant_id, v_subscription.id, 'scheduled', v_subscription.current_period_end,
    v_subscription.provider_subscription_ref, btrim(p_idempotency_key), p_request_fingerprint,
    p_requested_by, p_occurred_at, v_subscription.current_period_end
  ) returning * into v_request;

  update public.billing_subscriptions
  set cancel_at_period_end = true, version = version + 1
  where id = v_subscription.id;

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id, 'billing_subscription', v_request.id,
    'subscription.cancellation_scheduled',
    jsonb_build_object(
      'subscriptionId', v_subscription.id,
      'cancellationRequestId', v_request.id,
      'effectiveAt', v_request.effective_at,
      'semanticVersion', 1
    ),
    'billing:cancellation-scheduled:v1:' || v_request.id
  );
  return jsonb_build_object(
    'cancellationRequestId', v_request.id,
    'subscriptionId', v_subscription.id,
    'status', 'scheduled',
    'effectiveAt', v_request.effective_at,
    'duplicate', false
  );
end;
$$;

create function public.withdraw_subscription_cancellation(
  p_restaurant_id uuid,
  p_cancellation_request_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_withdrawn_by uuid,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_by_key public.subscription_cancellation_requests%rowtype;
  v_request public.subscription_cancellation_requests%rowtype;
begin
  if p_restaurant_id is null or p_cancellation_request_id is null or p_withdrawn_by is null
    or p_occurred_at is null
    or char_length(btrim(coalesce(p_idempotency_key, ''))) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'billing_cancellation_withdraw_input_invalid' using errcode = '22023';
  end if;
  select * into v_by_key from public.subscription_cancellation_requests
  where withdrawal_idempotency_key = btrim(p_idempotency_key) for update;
  if found then
    if v_by_key.id <> p_cancellation_request_id
      or v_by_key.restaurant_id <> p_restaurant_id
      or v_by_key.withdrawal_request_fingerprint <> p_request_fingerprint
      or v_by_key.withdrawn_by <> p_withdrawn_by then
      raise exception 'billing_cancellation_withdraw_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'cancellationRequestId', v_by_key.id,
      'subscriptionId', v_by_key.subscription_id,
      'status', v_by_key.status,
      'duplicate', true
    );
  end if;
  select * into v_request from public.subscription_cancellation_requests
  where id = p_cancellation_request_id and restaurant_id = p_restaurant_id for update;
  if not found or v_request.status <> 'scheduled' or v_request.effective_at <= p_occurred_at then
    raise exception 'billing_cancellation_withdraw_not_allowed' using errcode = '55000';
  end if;

  update public.subscription_cancellation_requests
  set status = 'withdrawn', withdrawal_idempotency_key = btrim(p_idempotency_key),
      withdrawal_request_fingerprint = p_request_fingerprint,
      withdrawn_by = p_withdrawn_by, withdrawn_at = p_occurred_at,
      locked_at = null, locked_by = null, last_error = null
  where id = v_request.id returning * into v_request;
  update public.billing_subscriptions
  set cancel_at_period_end = false, version = version + 1
  where id = v_request.subscription_id and restaurant_id = p_restaurant_id
    and status <> 'cancelled';

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id, 'billing_subscription', v_request.id,
    'subscription.cancellation_withdrawn',
    jsonb_build_object(
      'subscriptionId', v_request.subscription_id,
      'cancellationRequestId', v_request.id,
      'withdrawnAt', p_occurred_at,
      'semanticVersion', 1
    ),
    'billing:cancellation-withdrawn:v1:' || v_request.id
  );
  return jsonb_build_object(
    'cancellationRequestId', v_request.id,
    'subscriptionId', v_request.subscription_id,
    'status', 'withdrawn',
    'duplicate', false
  );
end;
$$;

create function public.claim_due_subscription_cancellations(
  p_worker text,
  p_limit integer default 20,
  p_lease_seconds integer default 60,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.subscription_cancellation_requests%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_customer public.billing_customers%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_fingerprint text;
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_limit not between 1 and 100 or p_lease_seconds not between 1 and 3600
    or p_occurred_at is null then
    raise exception 'billing_cancellation_claim_input_invalid' using errcode = '22023';
  end if;

  for v_request in
    select request.* from public.subscription_cancellation_requests request
    where request.status = 'processing'
      and request.locked_at < p_occurred_at - make_interval(secs => p_lease_seconds)
    order by request.locked_at for update skip locked
  loop
    update public.billing_provider_operations
    set status = 'requires_reconciliation', last_error = 'stale_scheduled_cancellation_claim'
    where id = v_request.provider_operation_id and status = 'processing';
    update public.subscription_cancellation_requests
    set status = 'requires_reconciliation', locked_at = null, locked_by = null,
        last_error = 'stale_scheduled_cancellation_claim'
    where id = v_request.id;
    insert into public.billing_reconciliation_jobs (
      restaurant_id, subscription_id, provider, scope, dedupe_key,
      local_snapshot, provider_snapshot_sanitized,
      discrepancy_code, last_error
    ) values (
      v_request.restaurant_id, v_request.subscription_id, 'iyzico', 'subscription',
      'provider-operation:' || v_request.provider_operation_id,
      jsonb_build_object('cancellationRequestId', v_request.id, 'effectiveAt', v_request.effective_at),
      '{}'::jsonb, 'scheduled_cancellation_result_ambiguous',
      'stale_scheduled_cancellation_claim'
    ) on conflict (dedupe_key) do nothing;
  end loop;

  for v_request in
    select request.* from public.subscription_cancellation_requests request
    where request.status = 'scheduled'
      and request.effective_at <= p_occurred_at
      and request.next_attempt_at <= p_occurred_at
    order by request.effective_at, request.created_at
    for update skip locked limit p_limit
  loop
    select * into v_subscription from public.billing_subscriptions subscription
    where subscription.id = v_request.subscription_id
      and subscription.restaurant_id = v_request.restaurant_id for update;
    select * into v_customer from public.billing_customers customer
    where customer.id = v_subscription.billing_customer_id
      and customer.restaurant_id = v_request.restaurant_id;
    if v_subscription.id is null or v_customer.id is null
      or v_subscription.status = 'cancelled'
      or not v_subscription.cancel_at_period_end
      or v_subscription.provider <> 'iyzico'
      or v_subscription.provider_subscription_ref is distinct from v_request.provider_subscription_ref then
      update public.subscription_cancellation_requests
      set status = 'requires_reconciliation',
          last_error = 'scheduled_cancellation_subscription_drift'
      where id = v_request.id;
      insert into public.billing_reconciliation_jobs (
        restaurant_id, subscription_id, provider, scope, dedupe_key,
        local_snapshot, provider_snapshot_sanitized, discrepancy_code, last_error
      ) values (
        v_request.restaurant_id, v_request.subscription_id, 'iyzico', 'subscription',
        'cancellation-request:' || v_request.id,
        jsonb_build_object('cancellationRequestId', v_request.id, 'effectiveAt', v_request.effective_at),
        '{}'::jsonb, 'scheduled_cancellation_subscription_drift',
        'scheduled_cancellation_subscription_drift'
      ) on conflict (dedupe_key) do nothing;
      continue;
    end if;
    v_fingerprint := encode(extensions.digest(convert_to(
      v_request.restaurant_id::text || E'\n' || v_request.subscription_id::text || E'\n'
      || v_request.id::text || E'\n' || v_request.provider_subscription_ref || E'\n'
      || v_request.effective_at::text, 'utf8'), 'sha256'), 'hex');
    insert into public.billing_provider_operations (
      restaurant_id, billing_customer_id, subscription_id,
      operation_type, idempotency_key, request_fingerprint, status,
      provider_subscription_ref
    ) values (
      v_request.restaurant_id, v_customer.id, v_request.subscription_id,
      'subscription.cancel', 'billing:period-end-cancel:' || v_request.id,
      v_fingerprint, 'processing', v_request.provider_subscription_ref
    ) returning * into v_operation;
    update public.subscription_cancellation_requests
    set status = 'processing', provider_operation_id = v_operation.id,
        attempts = attempts + 1, locked_at = p_occurred_at,
        locked_by = btrim(p_worker), last_error = null
    where id = v_request.id returning * into v_request;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'cancellationRequestId', v_request.id,
      'operationId', v_operation.id,
      'restaurantId', v_request.restaurant_id,
      'subscriptionId', v_request.subscription_id,
      'providerSubscriptionRef', v_request.provider_subscription_ref,
      'effectiveAt', v_request.effective_at,
      'attempts', v_request.attempts
    ));
  end loop;
  return v_results;
end;
$$;

create function public.complete_scheduled_subscription_cancellation(
  p_cancellation_request_id uuid,
  p_operation_id uuid,
  p_worker text,
  p_provider_cancelled_at timestamptz,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.subscription_cancellation_requests%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_from text;
begin
  if p_cancellation_request_id is null or p_operation_id is null
    or char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_provider_cancelled_at is null or p_occurred_at is null then
    raise exception 'billing_cancellation_complete_input_invalid' using errcode = '22023';
  end if;
  select * into v_request from public.subscription_cancellation_requests
  where id = p_cancellation_request_id for update;
  if not found then raise exception 'billing_cancellation_request_not_found' using errcode = 'P0002'; end if;
  if v_request.status = 'applied' then
    return jsonb_build_object(
      'cancellationRequestId', v_request.id, 'subscriptionId', v_request.subscription_id,
      'status', 'applied', 'duplicate', true
    );
  end if;
  if v_request.status <> 'processing' or v_request.provider_operation_id <> p_operation_id
    or v_request.locked_by <> btrim(p_worker)
    or p_occurred_at < v_request.effective_at
    or p_provider_cancelled_at < v_request.effective_at - interval '5 minutes' then
    raise exception 'billing_cancellation_completion_lease_lost' using errcode = '55P03';
  end if;
  select * into v_operation from public.billing_provider_operations operation
  where operation.id = p_operation_id and operation.operation_type = 'subscription.cancel'
    and operation.subscription_id = v_request.subscription_id
    and operation.restaurant_id = v_request.restaurant_id for update;
  select * into v_subscription from public.billing_subscriptions subscription
  where subscription.id = v_request.subscription_id
    and subscription.restaurant_id = v_request.restaurant_id for update;
  if v_operation.id is null or v_operation.status <> 'processing'
    or v_subscription.id is null or v_subscription.status = 'cancelled'
    or v_subscription.provider_subscription_ref is distinct from v_request.provider_subscription_ref
    or not v_subscription.cancel_at_period_end then
    raise exception 'billing_cancellation_completion_context_invalid' using errcode = 'P0001';
  end if;

  update public.billing_provider_operations
  set status = 'succeeded',
      result_sanitized = jsonb_build_object('cancelledAt', p_provider_cancelled_at),
      completed_at = p_occurred_at, last_error = null
  where id = v_operation.id;
  v_from := v_subscription.status;
  update public.billing_subscriptions
  set status = 'cancelled', cancelled_at = p_provider_cancelled_at,
      cancel_at_period_end = false, version = version + 1
  where id = v_subscription.id;
  update public.restaurants set plan = 'starter' where id = v_request.restaurant_id;
  update public.subscription_cancellation_requests
  set status = 'applied', applied_at = p_occurred_at,
      locked_at = null, locked_by = null, last_error = null
  where id = v_request.id;
  insert into public.tenant_lifecycle_events (
    restaurant_id, subscription_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, request_id, occurred_at
  ) values (
    v_request.restaurant_id, v_request.subscription_id, v_from, 'cancelled',
    'system', v_request.requested_by, 'tenant_cancelled_period_end',
    'billing:period-end-cancel:' || v_request.id, p_occurred_at
  ) on conflict (request_id) do nothing;
  perform public.enqueue_domain_outbox_event(
    v_request.restaurant_id, 'billing_subscription', v_request.id,
    'subscription.cancelled',
    jsonb_build_object(
      'subscriptionId', v_request.subscription_id,
      'cancellationRequestId', v_request.id,
      'effectiveAt', v_request.effective_at,
      'cancelledAt', p_provider_cancelled_at,
      'semanticVersion', 1
    ),
    'billing:subscription-cancelled:v1:' || v_request.id
  );
  perform public.enqueue_domain_outbox_event(
    v_request.restaurant_id, 'billing_subscription', v_request.subscription_id,
    'subscription.status_changed',
    jsonb_build_object('from', v_from, 'to', 'cancelled', 'reasonCode', 'tenant_cancelled_period_end'),
    'billing:period-end-cancel-status:v1:' || v_request.id
  );
  return jsonb_build_object(
    'cancellationRequestId', v_request.id, 'subscriptionId', v_request.subscription_id,
    'status', 'applied', 'duplicate', false
  );
end;
$$;

create function public.fail_scheduled_subscription_cancellation(
  p_cancellation_request_id uuid,
  p_operation_id uuid,
  p_worker text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.subscription_cancellation_requests%rowtype;
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_reason, ''))) not between 1 and 1000 then
    raise exception 'billing_cancellation_failure_input_invalid' using errcode = '22023';
  end if;
  select * into v_request from public.subscription_cancellation_requests
  where id = p_cancellation_request_id for update;
  if v_request.status = 'requires_reconciliation'
    and v_request.provider_operation_id = p_operation_id then return true; end if;
  if not found or v_request.status <> 'processing'
    or v_request.provider_operation_id <> p_operation_id
    or v_request.locked_by <> btrim(p_worker) then
    raise exception 'billing_cancellation_failure_lease_lost' using errcode = '55P03';
  end if;
  update public.billing_provider_operations
  set status = 'requires_reconciliation', last_error = left(btrim(p_reason), 1000)
  where id = p_operation_id and status = 'processing';
  update public.subscription_cancellation_requests
  set status = 'requires_reconciliation', locked_at = null, locked_by = null,
      last_error = left(btrim(p_reason), 1000)
  where id = v_request.id;
  insert into public.billing_reconciliation_jobs (
    restaurant_id, subscription_id, provider, scope, dedupe_key,
    local_snapshot, provider_snapshot_sanitized, discrepancy_code, last_error
  ) values (
    v_request.restaurant_id, v_request.subscription_id, 'iyzico', 'subscription',
    'provider-operation:' || p_operation_id,
    jsonb_build_object('cancellationRequestId', v_request.id, 'effectiveAt', v_request.effective_at),
    '{}'::jsonb, 'scheduled_cancellation_result_ambiguous', left(btrim(p_reason), 1000)
  ) on conflict (dedupe_key) do nothing;
  return true;
end;
$$;

create or replace function public.read_subscription_billing_settings(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb;
  v_subscription_id uuid;
  v_active_add_ons text[] := '{}'::text[];
  v_scheduled_add_ons text[] := '{}'::text[];
  v_cancellation public.subscription_cancellation_requests%rowtype;
  v_cancel_at_period_end boolean := false;
  v_invoices jsonb := '[]'::jsonb;
begin
  v_settings := public.read_subscription_billing_settings_before_add_on_lifecycle(p_restaurant_id);
  v_subscription_id := nullif(v_settings #>> '{subscription,id}', '')::uuid;
  if v_subscription_id is not null then
    select coalesce(array_agg(add_on order by add_on), '{}'::text[])
    into v_active_add_ons from public.restaurant_subscription_add_ons
    where restaurant_id = p_restaurant_id and subscription_id = v_subscription_id
      and status = 'active' and current_period_end > clock_timestamp();
    select coalesce(request.to_add_ons, '{}'::text[])
    into v_scheduled_add_ons from public.subscription_change_requests request
    where request.restaurant_id = p_restaurant_id
      and request.subscription_id = v_subscription_id
      and request.status in ('processing', 'scheduled', 'paid_pending', 'paid_draining', 'requires_reconciliation')
    order by request.created_at desc limit 1;
    v_scheduled_add_ons := coalesce(v_scheduled_add_ons, '{}'::text[]);
    select * into v_cancellation from public.subscription_cancellation_requests cancellation
    where cancellation.restaurant_id = p_restaurant_id
      and cancellation.subscription_id = v_subscription_id
      and cancellation.status in ('scheduled', 'processing', 'requires_reconciliation')
    order by cancellation.created_at desc limit 1;
    select subscription.cancel_at_period_end into v_cancel_at_period_end
    from public.billing_subscriptions subscription where subscription.id = v_subscription_id;
    v_settings := jsonb_set(v_settings, '{subscription}',
      (v_settings->'subscription') || jsonb_build_object(
        'activeAddOns', v_active_add_ons,
        'scheduledAddOns', v_scheduled_add_ons,
        'cancelAtPeriodEnd', coalesce(v_cancel_at_period_end, false),
        'cancellationRequestId', v_cancellation.id,
        'cancellationEffectiveAt', v_cancellation.effective_at,
        'cancellationStatus', v_cancellation.status
      ), true);
  end if;
  select coalesce(jsonb_agg(invoice_row order by created_at desc), '[]'::jsonb)
  into v_invoices from (
    select id, plan, add_ons as "addOns", billing_interval as "billingInterval",
      amount_due_minor as "amountDueMinor", amount_paid_minor as "amountPaidMinor",
      currency, status, period_start as "periodStart", period_end as "periodEnd",
      due_at as "dueAt", paid_at as "paidAt", failed_at as "failedAt",
      (status = 'past_due' and provider_invoice_ref is not null) as "canRetry", created_at
    from public.subscription_invoices where restaurant_id = p_restaurant_id
    order by created_at desc limit 12
  ) invoice_row;
  return jsonb_set(v_settings, '{invoices}', v_invoices, true);
end;
$$;

revoke all on function public.reject_subscription_change_during_scheduled_cancellation()
  from public, anon, authenticated;
revoke all on function public.schedule_subscription_cancellation(uuid,text,text,uuid,timestamptz)
  from public, anon, authenticated;
revoke all on function public.withdraw_subscription_cancellation(uuid,uuid,text,text,uuid,timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_due_subscription_cancellations(text,integer,integer,timestamptz)
  from public, anon, authenticated;
revoke all on function public.complete_scheduled_subscription_cancellation(uuid,uuid,text,timestamptz,timestamptz)
  from public, anon, authenticated;
revoke all on function public.fail_scheduled_subscription_cancellation(uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;

grant execute on function public.schedule_subscription_cancellation(uuid,text,text,uuid,timestamptz)
  to service_role;
grant execute on function public.withdraw_subscription_cancellation(uuid,uuid,text,text,uuid,timestamptz)
  to service_role;
grant execute on function public.claim_due_subscription_cancellations(text,integer,integer,timestamptz)
  to service_role;
grant execute on function public.complete_scheduled_subscription_cancellation(uuid,uuid,text,timestamptz,timestamptz)
  to service_role;
grant execute on function public.fail_scheduled_subscription_cancellation(uuid,uuid,text,text)
  to service_role;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;

comment on table public.subscription_cancellation_requests is
  'Owner period-end cancellation intent; provider dispatch is leased and ambiguity never closes access.';

commit;
