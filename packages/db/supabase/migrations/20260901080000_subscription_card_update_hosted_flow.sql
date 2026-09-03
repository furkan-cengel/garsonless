-- Phase 3c: durable hosted iyzico subscription-card update.
-- Card fields and the provider's 1 TRY validation/refund never enter Masabu.
-- Initialize creates a form; only the exact provider token callback completes
-- the operation, bound to a separately generated one-time state hash.

begin;

alter table public.domain_outbox drop constraint if exists domain_outbox_event_type_check;
alter table public.domain_outbox add constraint domain_outbox_event_type_check
  check (event_type in (
    'order.created', 'order.status_changed', 'order.settled',
    'table_session.closed', 'service_request.created',
    'customer.welcome_bonus_requested', 'campaign.delivery_requested',
    'subscription.trial_started', 'subscription.status_changed',
    'invoice.created', 'invoice.upcoming', 'invoice.payment_failed', 'invoice.paid',
    'billing.retry_requested', 'billing.warning_3', 'billing.warning_7',
    'billing.reconciliation_required',
    'plan.change_scheduled', 'plan.changed', 'payment_method.updated',
    'tenant.suspended', 'tenant.reactivated'
  ));

alter table public.billing_provider_operations
  add column callback_state_hash text;
alter table public.billing_provider_operations
  add constraint billing_provider_operations_callback_state_hash_check check (
    (operation_type = 'card_update.initialize' and callback_state_hash ~ '^[a-f0-9]{64}$')
    or (operation_type <> 'card_update.initialize' and callback_state_hash is null)
  );

create unique index billing_provider_operations_one_live_card_update_idx
  on public.billing_provider_operations(subscription_id)
  where operation_type = 'card_update.initialize'
    and status in ('processing', 'awaiting_callback', 'requires_reconciliation');

create function public.prepare_subscription_card_update(
  p_restaurant_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_callback_state_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.billing_provider_operations%rowtype;
  v_customer public.billing_customers%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_operation public.billing_provider_operations%rowtype;
begin
  if char_length(btrim(coalesce(p_idempotency_key, ''))) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or p_callback_state_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'billing_card_update_input_invalid' using errcode = '22023';
  end if;

  select * into v_existing from public.billing_provider_operations
  where idempotency_key = btrim(p_idempotency_key) for update;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.operation_type <> 'card_update.initialize'
      or v_existing.request_fingerprint <> p_request_fingerprint
      or v_existing.callback_state_hash <> p_callback_state_hash then
      raise exception 'billing_operation_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'operationId', v_existing.id,
      'subscriptionId', v_existing.subscription_id,
      'providerSubscriptionRef', v_existing.provider_subscription_ref,
      'status', v_existing.status,
      'providerCheckoutRef', v_existing.provider_checkout_ref,
      'expiresAt', v_existing.provider_checkout_expires_at,
      'dispatchable', false,
      'duplicate', true
    );
  end if;

  select * into v_subscription from public.billing_subscriptions subscription
  where subscription.restaurant_id = p_restaurant_id
    and subscription.provider = 'iyzico'
    and subscription.status in ('active', 'past_due', 'grace_period', 'suspended', 'manual_hold')
  order by subscription.created_at desc
  limit 1
  for update;
  if not found or coalesce(char_length(btrim(v_subscription.provider_subscription_ref)), 0) not between 1 and 200 then
    raise exception 'billing_card_update_subscription_not_found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.subscription_change_requests request
    where request.subscription_id = v_subscription.id
      and request.status in (
        'processing', 'scheduled', 'paid_pending', 'paid_draining', 'requires_reconciliation'
      )
  ) then
    raise exception 'billing_card_update_plan_change_in_progress' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.billing_subscription_provider_refs provider_ref
    where provider_ref.provider = 'iyzico'
      and provider_ref.provider_subscription_ref = v_subscription.provider_subscription_ref
      and provider_ref.subscription_id = v_subscription.id
      and provider_ref.restaurant_id = p_restaurant_id
      and provider_ref.ref_role = 'current'
  ) then
    raise exception 'billing_card_update_provider_binding_missing' using errcode = 'P0001';
  end if;

  select * into v_customer from public.billing_customers customer
  where customer.id = v_subscription.billing_customer_id
    and customer.restaurant_id = p_restaurant_id
  for update;
  if not found or coalesce(char_length(btrim(v_customer.provider_customer_ref)), 0) not between 1 and 200 then
    raise exception 'billing_card_update_customer_binding_missing' using errcode = 'P0001';
  end if;

  insert into public.billing_provider_operations (
    restaurant_id, billing_customer_id, subscription_id, operation_type,
    idempotency_key, request_fingerprint, callback_state_hash, status,
    provider_subscription_ref, result_sanitized
  ) values (
    p_restaurant_id, v_customer.id, v_subscription.id, 'card_update.initialize',
    btrim(p_idempotency_key), p_request_fingerprint, p_callback_state_hash,
    'processing', v_subscription.provider_subscription_ref,
    jsonb_build_object('source', 'hosted_card_update')
  ) returning * into v_operation;

  return jsonb_build_object(
    'operationId', v_operation.id,
    'subscriptionId', v_subscription.id,
    'providerSubscriptionRef', v_subscription.provider_subscription_ref,
    'status', v_operation.status,
    'providerCheckoutRef', null,
    'expiresAt', null,
    'dispatchable', true,
    'duplicate', false
  );
end;
$$;

create function public.mark_subscription_card_update_initialized(
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
  if coalesce(char_length(btrim(p_provider_checkout_ref)), 0) not between 1 and 200
    or v_expires_at <= clock_timestamp() then
    raise exception 'billing_card_update_initialization_invalid' using errcode = '22023';
  end if;
  update public.billing_provider_operations
  set status = 'awaiting_callback',
      provider_checkout_ref = btrim(p_provider_checkout_ref),
      provider_checkout_expires_at = v_expires_at,
      last_error = null
  where id = p_operation_id
    and operation_type = 'card_update.initialize'
    and status = 'processing';
  if not found then
    raise exception 'billing_card_update_operation_not_claimed' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create function public.complete_subscription_card_update(
  p_provider_checkout_ref text,
  p_callback_state text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_state_hash text;
begin
  if coalesce(char_length(btrim(p_provider_checkout_ref)), 0) not between 1 and 200
    or coalesce(char_length(p_callback_state), 0) not between 32 and 200
    or p_callback_state !~ '^[A-Za-z0-9_-]+$'
    or p_occurred_at is null then
    raise exception 'billing_card_update_callback_invalid' using errcode = '22023';
  end if;
  v_state_hash := encode(
    extensions.digest(convert_to(p_callback_state, 'utf8'), 'sha256'),
    'hex'
  );

  select * into v_operation from public.billing_provider_operations operation
  where operation.provider = 'iyzico'
    and operation.operation_type = 'card_update.initialize'
    and operation.provider_checkout_ref = btrim(p_provider_checkout_ref)
  for update;
  if not found then
    raise exception 'billing_card_update_operation_not_found' using errcode = 'P0002';
  end if;
  if v_operation.callback_state_hash <> v_state_hash then
    raise exception 'billing_card_update_callback_state_mismatch' using errcode = 'P0001';
  end if;
  if v_operation.status = 'succeeded' then
    return jsonb_build_object(
      'operationId', v_operation.id,
      'restaurantId', v_operation.restaurant_id,
      'subscriptionId', v_operation.subscription_id,
      'outcome', 'succeeded',
      'duplicate', true
    );
  end if;
  if v_operation.status not in ('awaiting_callback', 'requires_reconciliation') then
    raise exception 'billing_card_update_callback_not_expected' using errcode = 'P0001';
  end if;

  select * into v_subscription from public.billing_subscriptions subscription
  where subscription.id = v_operation.subscription_id
    and subscription.restaurant_id = v_operation.restaurant_id
  for update;
  if not found or v_subscription.provider <> 'iyzico'
    or v_subscription.provider_subscription_ref is distinct from v_operation.provider_subscription_ref
    or v_subscription.status = 'cancelled' then
    update public.billing_provider_operations
    set status = 'requires_reconciliation',
        last_error = 'billing_card_update_subscription_drift'
    where id = v_operation.id;
    insert into public.billing_reconciliation_jobs (
      restaurant_id, subscription_id, provider, scope, dedupe_key, status,
      scheduled_at, local_snapshot, provider_snapshot_sanitized,
      discrepancy_code, last_error
    ) values (
      v_operation.restaurant_id, v_operation.subscription_id, 'iyzico', 'subscription',
      'provider-operation:' || v_operation.id, 'pending', clock_timestamp(),
      jsonb_build_object(
        'operationId', v_operation.id,
        'expectedProviderSubscriptionRef', v_operation.provider_subscription_ref
      ),
      jsonb_build_object('callbackReceivedAt', p_occurred_at),
      'billing_card_update_subscription_drift',
      'billing_card_update_subscription_drift'
    ) on conflict (dedupe_key) do update
    set status = case when public.billing_reconciliation_jobs.status = 'resolved'
        then 'resolved' else 'pending' end,
        scheduled_at = clock_timestamp(),
        discrepancy_code = excluded.discrepancy_code,
        last_error = excluded.last_error;
    return jsonb_build_object(
      'operationId', v_operation.id,
      'restaurantId', v_operation.restaurant_id,
      'subscriptionId', v_operation.subscription_id,
      'outcome', 'ambiguous',
      'duplicate', false
    );
  end if;

  update public.billing_provider_operations
  set status = 'succeeded',
      completed_at = p_occurred_at,
      last_error = null,
      result_sanitized = jsonb_build_object(
        'source', 'hosted_card_update_callback',
        'completedAt', p_occurred_at
      )
  where id = v_operation.id;

  perform public.enqueue_domain_outbox_event(
    v_operation.restaurant_id,
    'billing_subscription',
    v_operation.subscription_id,
    'payment_method.updated',
    jsonb_build_object(
      'subscriptionId', v_operation.subscription_id,
      'operationId', v_operation.id,
      'updatedAt', p_occurred_at,
      'semanticVersion', 1
    ),
    'billing:payment-method-updated:v1:' || v_operation.id
  );

  update public.billing_reconciliation_jobs
  set status = 'resolved', completed_at = p_occurred_at,
      locked_at = null, locked_by = null,
      discrepancy_code = null, last_error = null
  where dedupe_key = 'provider-operation:' || v_operation.id
    and status <> 'resolved';

  return jsonb_build_object(
    'operationId', v_operation.id,
    'restaurantId', v_operation.restaurant_id,
    'subscriptionId', v_operation.subscription_id,
    'outcome', 'succeeded',
    'duplicate', false
  );
end;
$$;

revoke all on function public.prepare_subscription_card_update(uuid,text,text,text)
  from public, anon, authenticated;
revoke all on function public.mark_subscription_card_update_initialized(uuid,text,timestamptz)
  from public, anon, authenticated;
revoke all on function public.complete_subscription_card_update(text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.prepare_subscription_card_update(uuid,text,text,text)
  to service_role;
grant execute on function public.mark_subscription_card_update_initialized(uuid,text,timestamptz)
  to service_role;
grant execute on function public.complete_subscription_card_update(text,text,timestamptz)
  to service_role;

comment on function public.complete_subscription_card_update(text,text,timestamptz)
  is 'Completes a hosted iyzico card update from the exact initialized token and one-time callback state; never records card data or payment evidence.';

commit;
