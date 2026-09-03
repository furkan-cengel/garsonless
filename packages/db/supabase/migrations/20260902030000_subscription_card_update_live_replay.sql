-- Reuse a live hosted card-update operation instead of colliding with the
-- one-live-operation index. Expired callback sessions become terminal before
-- a new explicit request is allowed to create another provider operation.

begin;

create or replace function public.prepare_subscription_card_update(
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

  update public.billing_provider_operations operation
  set status = 'expired',
      completed_at = coalesce(operation.completed_at, clock_timestamp()),
      last_error = coalesce(operation.last_error, 'billing_card_update_callback_timeout'),
      result_sanitized = operation.result_sanitized || jsonb_build_object(
        'expiredReason', 'callback_timeout'
      )
  where operation.subscription_id = v_subscription.id
    and operation.operation_type = 'card_update.initialize'
    and operation.status = 'awaiting_callback'
    and operation.provider_checkout_expires_at is not null
    and operation.provider_checkout_expires_at <= clock_timestamp();

  select * into v_existing
  from public.billing_provider_operations operation
  where operation.subscription_id = v_subscription.id
    and operation.operation_type = 'card_update.initialize'
    and operation.status in ('processing', 'awaiting_callback', 'requires_reconciliation')
  order by operation.created_at desc
  limit 1
  for update;
  if found then
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

revoke all on function public.prepare_subscription_card_update(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.prepare_subscription_card_update(uuid,text,text,text)
  to service_role;

comment on function public.prepare_subscription_card_update(uuid,text,text,text)
  is 'Prepares one hosted iyzico card update per subscription, safely replaying a live operation and expiring elapsed callback sessions before a new explicit request.';

commit;
