-- Phase 5b: authenticated SaaS payment identity and finance-only refund ledger.
-- Refunds are money movement only: they never mutate subscription or feature
-- entitlement state. Provider uncertainty is terminal until reconciliation.

begin;

alter table public.subscription_payment_attempts
  add column provider_payment_id text;
alter table public.subscription_payment_attempts
  add constraint subscription_payment_attempts_provider_payment_id_check
    check (provider_payment_id is null or char_length(btrim(provider_payment_id)) between 1 and 200);
alter table public.subscription_payment_attempts
  add constraint subscription_payment_attempts_restaurant_id_id_key unique (restaurant_id, id);
create unique index subscription_payment_attempts_provider_payment_id_idx
  on public.subscription_payment_attempts(provider, provider_payment_id)
  where provider_payment_id is not null;

create function public.bind_subscription_payment_provider_id(
  p_invoice_id uuid,
  p_provider_invoice_ref text,
  p_provider_payment_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subscription_invoices%rowtype;
  v_attempt public.subscription_payment_attempts%rowtype;
begin
  if p_invoice_id is null
    or coalesce(char_length(btrim(p_provider_invoice_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_payment_id)), 0) not between 1 and 200 then
    raise exception 'billing_payment_identity_input_invalid' using errcode = '22023';
  end if;

  select * into v_invoice from public.subscription_invoices
  where id = p_invoice_id for update;
  if not found or v_invoice.provider <> 'iyzico' or v_invoice.status <> 'paid'
    or v_invoice.provider_invoice_ref is distinct from btrim(p_provider_invoice_ref) then
    raise exception 'billing_payment_identity_invoice_mismatch' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.subscription_payment_attempts
  where invoice_id = v_invoice.id and status = 'succeeded' for update;
  if not found or v_attempt.provider <> 'iyzico'
    or v_attempt.provider_attempt_ref is distinct from btrim(p_provider_invoice_ref)
    or (v_attempt.provider_payment_id is not null
      and v_attempt.provider_payment_id <> btrim(p_provider_payment_id)) then
    raise exception 'billing_payment_identity_attempt_mismatch' using errcode = 'P0001';
  end if;

  update public.subscription_payment_attempts
  set provider_payment_id = btrim(p_provider_payment_id)
  where id = v_attempt.id and provider_payment_id is null;
  return true;
end;
$$;

create function public.complete_platform_subscription_refund(
  p_refund_id uuid,
  p_operation_id uuid,
  p_provider_payment_id text,
  p_provider_refund_ref text,
  p_amount_minor bigint,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund record;
  v_operation public.billing_provider_operations%rowtype;
begin
  if p_refund_id is null or p_operation_id is null or p_amount_minor <= 0 or p_occurred_at is null
    or coalesce(char_length(btrim(p_provider_payment_id)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_refund_ref)), 0) not between 1 and 200 then
    raise exception 'subscription_refund_completion_input_invalid' using errcode = '22023';
  end if;

  select * into v_refund from public.subscription_refunds
  where id = p_refund_id for update;
  if not found or v_refund.provider_operation_id <> p_operation_id
    or v_refund.provider_payment_id <> btrim(p_provider_payment_id)
    or v_refund.amount_minor <> p_amount_minor then
    raise exception 'subscription_refund_completion_mismatch' using errcode = 'P0001';
  end if;
  if v_refund.status = 'succeeded' then
    if v_refund.provider_refund_ref <> btrim(p_provider_refund_ref) then
      raise exception 'subscription_refund_completion_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'refundId', v_refund.id, 'operationId', v_refund.provider_operation_id,
      'restaurantId', v_refund.restaurant_id, 'subscriptionId', v_refund.subscription_id,
      'invoiceId', v_refund.invoice_id, 'kind', v_refund.kind, 'scope', v_refund.scope,
      'amountMinor', v_refund.amount_minor, 'currency', v_refund.currency,
      'status', v_refund.status, 'providerRefundRef', v_refund.provider_refund_ref,
      'dispatchable', false, 'duplicate', true
    );
  end if;
  if v_refund.status <> 'processing' then
    raise exception 'subscription_refund_not_completable' using errcode = '55000';
  end if;

  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.refund' for update;
  if not found or v_operation.status <> 'processing'
    or v_operation.restaurant_id <> v_refund.restaurant_id
    or v_operation.subscription_id <> v_refund.subscription_id
    or v_operation.invoice_id <> v_refund.invoice_id
    or v_operation.provider_payment_ref <> v_refund.provider_payment_id
    or v_operation.amount_minor <> v_refund.amount_minor
    or v_operation.currency <> v_refund.currency then
    raise exception 'subscription_refund_operation_mismatch' using errcode = 'P0001';
  end if;

  update public.subscription_refunds
  set status = 'succeeded', provider_refund_ref = btrim(p_provider_refund_ref),
      completed_at = p_occurred_at, failed_at = null, failure_code = null
  where id = v_refund.id returning * into v_refund;
  update public.billing_provider_operations
  set status = 'succeeded', completed_at = p_occurred_at, last_error = null,
      result_sanitized = result_sanitized || jsonb_build_object(
        'refundId', v_refund.id, 'providerRefundRef', btrim(p_provider_refund_ref),
        'kind', v_refund.kind, 'scope', v_refund.scope
      )
  where id = v_operation.id;

  insert into public.accounting_review_jobs (
    restaurant_id, subscription_id, reason, source_key
  ) values (
    v_refund.restaurant_id, v_refund.subscription_id, 'refund_reported',
    'subscription-refund:' || v_refund.id
  ) on conflict (source_key) do nothing;

  perform public.enqueue_domain_outbox_event(
    v_refund.restaurant_id, 'billing_refund', v_refund.id, 'refund.succeeded',
    jsonb_build_object('refundId', v_refund.id, 'invoiceId', v_refund.invoice_id,
      'amountMinor', v_refund.amount_minor, 'currency', v_refund.currency,
      'kind', v_refund.kind, 'scope', v_refund.scope, 'semanticVersion', 1),
    'subscription-refund-succeeded:' || v_refund.id
  );
  return jsonb_build_object(
    'refundId', v_refund.id, 'operationId', v_refund.provider_operation_id,
    'restaurantId', v_refund.restaurant_id, 'subscriptionId', v_refund.subscription_id,
    'invoiceId', v_refund.invoice_id, 'kind', v_refund.kind, 'scope', v_refund.scope,
    'amountMinor', v_refund.amount_minor, 'currency', v_refund.currency,
    'status', v_refund.status, 'providerRefundRef', v_refund.provider_refund_ref,
    'dispatchable', false, 'duplicate', false
  );
end;
$$;

create function public.fail_platform_subscription_refund(
  p_refund_id uuid,
  p_operation_id uuid,
  p_failure_code text,
  p_requires_reconciliation boolean,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund record;
  v_operation public.billing_provider_operations%rowtype;
  v_status text;
  v_reconciliation public.billing_reconciliation_jobs%rowtype;
begin
  if p_refund_id is null or p_operation_id is null or p_requires_reconciliation is null
    or p_occurred_at is null
    or coalesce(char_length(btrim(p_failure_code)), 0) not between 1 and 100 then
    raise exception 'subscription_refund_failure_input_invalid' using errcode = '22023';
  end if;
  select * into v_refund from public.subscription_refunds
  where id = p_refund_id for update;
  if not found or v_refund.provider_operation_id <> p_operation_id then
    raise exception 'subscription_refund_failure_mismatch' using errcode = 'P0001';
  end if;
  if v_refund.status in ('failed', 'requires_reconciliation') then
    if v_refund.failure_code <> btrim(p_failure_code)
      or (v_refund.status = 'requires_reconciliation') <> p_requires_reconciliation then
      raise exception 'subscription_refund_failure_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'refundId', v_refund.id, 'operationId', v_refund.provider_operation_id,
      'restaurantId', v_refund.restaurant_id, 'subscriptionId', v_refund.subscription_id,
      'invoiceId', v_refund.invoice_id, 'kind', v_refund.kind, 'scope', v_refund.scope,
      'amountMinor', v_refund.amount_minor, 'currency', v_refund.currency,
      'status', v_refund.status, 'providerRefundRef', null,
      'dispatchable', false, 'duplicate', true
    );
  end if;
  if v_refund.status <> 'processing' then
    raise exception 'subscription_refund_not_failable' using errcode = '55000';
  end if;
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.refund' for update;
  if not found or v_operation.status <> 'processing'
    or v_operation.restaurant_id <> v_refund.restaurant_id then
    raise exception 'subscription_refund_operation_mismatch' using errcode = 'P0001';
  end if;

  v_status := case when p_requires_reconciliation then 'requires_reconciliation' else 'failed' end;
  update public.subscription_refunds
  set status = v_status, failure_code = btrim(p_failure_code),
      failed_at = case when p_requires_reconciliation then null else p_occurred_at end
  where id = v_refund.id returning * into v_refund;
  update public.billing_provider_operations
  set status = case when p_requires_reconciliation then 'requires_reconciliation' else 'expired' end,
      completed_at = case when p_requires_reconciliation then null else p_occurred_at end,
      last_error = btrim(p_failure_code)
  where id = v_operation.id;

  if p_requires_reconciliation then
    insert into public.billing_reconciliation_jobs (
      restaurant_id, subscription_id, provider, scope, dedupe_key, status,
      scheduled_at, local_snapshot, provider_snapshot_sanitized, discrepancy_code, last_error
    ) values (
      v_refund.restaurant_id, v_refund.subscription_id, 'iyzico', 'invoice',
      'subscription-refund:' || v_refund.id, 'discrepancy', p_occurred_at,
      jsonb_build_object('refundId', v_refund.id, 'invoiceId', v_refund.invoice_id,
        'operationId', v_refund.provider_operation_id, 'amountMinor', v_refund.amount_minor,
        'currency', v_refund.currency, 'status', v_refund.status),
      '{}'::jsonb, 'subscription_refund_provider_uncertain', btrim(p_failure_code)
    ) on conflict (dedupe_key) do update
      set status = 'discrepancy', completed_at = null,
          discrepancy_code = excluded.discrepancy_code, last_error = excluded.last_error
    returning * into v_reconciliation;
    perform public.enqueue_domain_outbox_event(
      v_refund.restaurant_id, 'billing_reconciliation', v_reconciliation.id,
      'billing.reconciliation_required',
      jsonb_build_object('scope', 'invoice', 'invoiceId', v_refund.invoice_id,
        'refundId', v_refund.id, 'semanticVersion', 1),
      'subscription-refund-reconciliation:' || v_refund.id
    );
  else
    perform public.enqueue_domain_outbox_event(
      v_refund.restaurant_id, 'billing_refund', v_refund.id, 'refund.failed',
      jsonb_build_object('refundId', v_refund.id, 'invoiceId', v_refund.invoice_id,
        'amountMinor', v_refund.amount_minor, 'currency', v_refund.currency,
        'kind', v_refund.kind, 'scope', v_refund.scope, 'semanticVersion', 1),
      'subscription-refund-failed:' || v_refund.id
    );
  end if;
  return jsonb_build_object(
    'refundId', v_refund.id, 'operationId', v_refund.provider_operation_id,
    'restaurantId', v_refund.restaurant_id, 'subscriptionId', v_refund.subscription_id,
    'invoiceId', v_refund.invoice_id, 'kind', v_refund.kind, 'scope', v_refund.scope,
    'amountMinor', v_refund.amount_minor, 'currency', v_refund.currency,
    'status', v_refund.status, 'providerRefundRef', null,
    'dispatchable', false, 'duplicate', false
  );
end;
$$;

revoke all on function public.bind_subscription_payment_provider_id(uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.complete_platform_subscription_refund(
  uuid,uuid,text,text,bigint,timestamptz
) from public, anon, authenticated;
revoke all on function public.fail_platform_subscription_refund(
  uuid,uuid,text,boolean,timestamptz
) from public, anon, authenticated;
grant execute on function public.bind_subscription_payment_provider_id(uuid,text,text)
  to service_role;
grant execute on function public.complete_platform_subscription_refund(
  uuid,uuid,text,text,bigint,timestamptz
) to service_role;
grant execute on function public.fail_platform_subscription_refund(
  uuid,uuid,text,boolean,timestamptz
) to service_role;

comment on function public.bind_subscription_payment_provider_id(uuid,text,text) is
  'Convergently binds an authenticated iyzico paymentId to the exact successful local payment attempt.';

alter table public.billing_provider_operations
  drop constraint if exists billing_provider_operations_operation_type_check;
alter table public.billing_provider_operations
  add constraint billing_provider_operations_operation_type_check
    check (operation_type in (
      'checkout.initialize', 'payment.retry', 'subscription.cancel',
      'subscription.change', 'card_update.initialize', 'subscription.refund'
    )),
  add constraint billing_provider_operations_refund_shape_check check (
    operation_type <> 'subscription.refund'
    or (invoice_id is not null and subscription_id is not null
      and provider_payment_ref is not null and amount_minor is not null
      and amount_minor > 0 and currency = 'TRY')
  );

alter table public.domain_outbox drop constraint if exists domain_outbox_aggregate_type_check;
alter table public.domain_outbox add constraint domain_outbox_aggregate_type_check
  check (aggregate_type in (
    'order', 'table_session', 'service_request', 'customer', 'campaign',
    'billing_subscription', 'billing_invoice', 'billing_reconciliation', 'billing_refund'
  ));
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
    'refund.requested', 'refund.succeeded', 'refund.failed',
    'tenant.suspended', 'tenant.reactivated'
  ));

create table public.subscription_refunds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid not null,
  invoice_id uuid not null,
  payment_attempt_id uuid not null,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_payment_id text not null
    check (char_length(btrim(provider_payment_id)) between 1 and 200),
  provider_refund_ref text
    check (provider_refund_ref is null or char_length(btrim(provider_refund_ref)) between 1 and 200),
  provider_operation_id uuid not null unique
    references public.billing_provider_operations(id) on delete restrict,
  kind text not null check (kind in ('same_day_cancel', 'refund')),
  scope text not null check (scope in ('full', 'partial')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'TRY' check (currency = 'TRY'),
  reason_code text not null check (reason_code in (
    'customer_request', 'billing_error', 'duplicate_charge',
    'service_issue', 'legal', 'other'
  )),
  reason_detail text not null check (char_length(btrim(reason_detail)) between 10 and 1000),
  status text not null check (status in (
    'requested', 'processing', 'succeeded', 'failed', 'requires_reconciliation'
  )),
  idempotency_key text not null unique
    check (char_length(btrim(idempotency_key)) between 1 and 160),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  request_id uuid not null,
  requested_by uuid not null references public.platform_admin_users(user_id) on delete restrict,
  requested_at timestamptz not null,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text check (failure_code is null or char_length(btrim(failure_code)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, subscription_id, invoice_id)
    references public.subscription_invoices(restaurant_id, subscription_id, id) on delete restrict,
  foreign key (restaurant_id, payment_attempt_id)
    references public.subscription_payment_attempts(restaurant_id, id) on delete restrict,
  check (
    (status in ('requested', 'processing') and completed_at is null and failed_at is null
      and provider_refund_ref is null and failure_code is null)
    or (status = 'succeeded' and completed_at is not null and failed_at is null
      and provider_refund_ref is not null and failure_code is null)
    or (status = 'failed' and completed_at is null and failed_at is not null
      and provider_refund_ref is null and failure_code is not null)
    or (status = 'requires_reconciliation' and completed_at is null and failed_at is null
      and provider_refund_ref is null and failure_code is not null)
  )
);

create index subscription_refunds_invoice_idx
  on public.subscription_refunds(invoice_id, created_at desc);
create index subscription_refunds_restaurant_idx
  on public.subscription_refunds(restaurant_id, created_at desc);
create unique index subscription_refunds_provider_ref_idx
  on public.subscription_refunds(provider, provider_refund_ref)
  where provider_refund_ref is not null;

create trigger subscription_refunds_updated_at
  before update on public.subscription_refunds
  for each row execute function public.update_updated_at();

alter table public.subscription_refunds enable row level security;
alter table public.subscription_refunds force row level security;
revoke all on table public.subscription_refunds from public, anon, authenticated;
grant select, insert, update on table public.subscription_refunds to service_role;

create function public.prepare_platform_subscription_refund(
  p_restaurant_id uuid,
  p_invoice_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_kind text,
  p_amount_minor bigint,
  p_reason_code text,
  p_reason_detail text,
  p_request_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_occurred_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_existing public.subscription_refunds%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_attempt public.subscription_payment_attempts%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_refund public.subscription_refunds%rowtype;
  v_reserved bigint;
  v_scope text;
  v_after jsonb;
begin
  if p_restaurant_id is null or p_invoice_id is null or p_actor_user_id is null
    or p_request_id is null or p_occurred_at is null
    or p_kind not in ('same_day_cancel', 'refund') or p_amount_minor <= 0
    or p_reason_code not in ('customer_request', 'billing_error', 'duplicate_charge', 'service_issue', 'legal', 'other')
    or char_length(btrim(coalesce(p_reason_detail, ''))) not between 10 and 1000
    or char_length(btrim(coalesce(p_idempotency_key, ''))) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'subscription_refund_input_invalid' using errcode = '22023';
  end if;

  select * into v_identity from public.platform_admin_users
  where user_id = p_actor_user_id for update;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role
    or v_identity.role not in ('finance', 'superadmin') then
    raise exception 'subscription_refund_not_authorized' using errcode = '42501';
  end if;

  select * into v_existing from public.subscription_refunds
  where idempotency_key = btrim(p_idempotency_key) for update;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.invoice_id <> p_invoice_id
      or v_existing.requested_by <> p_actor_user_id
      or v_existing.request_id <> p_request_id
      or v_existing.request_fingerprint <> p_request_fingerprint
      or v_existing.kind <> p_kind
      or v_existing.amount_minor <> p_amount_minor
      or v_existing.reason_code <> p_reason_code
      or v_existing.reason_detail <> btrim(p_reason_detail) then
      raise exception 'subscription_refund_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'refundId', v_existing.id, 'operationId', v_existing.provider_operation_id,
      'restaurantId', v_existing.restaurant_id, 'subscriptionId', v_existing.subscription_id,
      'invoiceId', v_existing.invoice_id, 'providerPaymentId', v_existing.provider_payment_id,
      'kind', v_existing.kind, 'scope', v_existing.scope,
      'amountMinor', v_existing.amount_minor, 'currency', v_existing.currency,
      'status', v_existing.status, 'dispatchable', false, 'duplicate', true
    );
  end if;

  perform 1 from public.restaurants
  where id = p_restaurant_id and deleted_at is null for update;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  select * into v_invoice from public.subscription_invoices
  where id = p_invoice_id and restaurant_id = p_restaurant_id for update;
  if not found or v_invoice.provider <> 'iyzico' or v_invoice.status <> 'paid'
    or v_invoice.amount_paid_minor <= 0 or v_invoice.paid_at is null then
    raise exception 'subscription_refund_invoice_not_paid' using errcode = '55000';
  end if;

  select * into v_subscription from public.billing_subscriptions
  where id = v_invoice.subscription_id and restaurant_id = p_restaurant_id for update;
  if not found or v_subscription.provider <> 'iyzico' then
    raise exception 'subscription_refund_subscription_mismatch' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.subscription_payment_attempts
  where invoice_id = v_invoice.id and restaurant_id = p_restaurant_id and status = 'succeeded'
  for update;
  if not found or v_attempt.provider_payment_id is null then
    raise exception 'subscription_refund_payment_identity_missing' using errcode = '55000';
  end if;

  select coalesce(sum(amount_minor), 0) into v_reserved
  from public.subscription_refunds
  where invoice_id = v_invoice.id
    and status in ('requested', 'processing', 'succeeded', 'requires_reconciliation');
  if p_amount_minor > v_invoice.amount_paid_minor - v_reserved then
    raise exception 'subscription_refund_amount_exceeds_available' using errcode = '22003';
  end if;
  if p_kind = 'same_day_cancel' and (
    v_reserved <> 0 or p_amount_minor <> v_invoice.amount_paid_minor
    or (v_invoice.paid_at at time zone 'Europe/Istanbul')::date
      <> (p_occurred_at at time zone 'Europe/Istanbul')::date
  ) then
    raise exception 'subscription_same_day_cancel_not_eligible' using errcode = '55000';
  end if;
  v_scope := case when v_reserved = 0 and p_amount_minor = v_invoice.amount_paid_minor
    then 'full' else 'partial' end;

  insert into public.billing_provider_operations (
    restaurant_id, billing_customer_id, subscription_id, invoice_id,
    operation_type, idempotency_key, request_fingerprint, status,
    amount_minor, currency, provider_payment_ref
  ) values (
    p_restaurant_id, v_subscription.billing_customer_id, v_subscription.id, v_invoice.id,
    'subscription.refund', btrim(p_idempotency_key), p_request_fingerprint, 'processing',
    p_amount_minor, 'TRY', v_attempt.provider_payment_id
  ) returning * into v_operation;

  insert into public.subscription_refunds (
    restaurant_id, subscription_id, invoice_id, payment_attempt_id,
    provider_payment_id, provider_operation_id, kind, scope, amount_minor,
    reason_code, reason_detail, status, idempotency_key, request_fingerprint,
    request_id, requested_by, requested_at
  ) values (
    p_restaurant_id, v_subscription.id, v_invoice.id, v_attempt.id,
    v_attempt.provider_payment_id, v_operation.id, p_kind, v_scope, p_amount_minor,
    p_reason_code, btrim(p_reason_detail), 'processing', btrim(p_idempotency_key),
    p_request_fingerprint, p_request_id, p_actor_user_id, p_occurred_at
  ) returning * into v_refund;

  v_after := jsonb_build_object(
    'refundId', v_refund.id, 'operationId', v_operation.id,
    'restaurantId', p_restaurant_id, 'subscriptionId', v_subscription.id,
    'invoiceId', v_invoice.id, 'providerPaymentId', v_attempt.provider_payment_id,
    'kind', p_kind, 'scope', v_scope, 'amountMinor', p_amount_minor,
    'currency', 'TRY', 'status', 'processing', 'dispatchable', true,
    'duplicate', false
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_actor_user_id, v_identity.role, 'billing.subscription_refund.request',
    'billing_invoice', v_invoice.id::text, btrim(p_reason_detail), p_request_id,
    jsonb_build_object('restaurantId', p_restaurant_id, 'invoiceId', v_invoice.id,
      'paidMinor', v_invoice.amount_paid_minor, 'reservedMinor', v_reserved),
    v_after - 'providerPaymentId'
  );

  perform public.enqueue_domain_outbox_event(
    p_restaurant_id, 'billing_refund', v_refund.id, 'refund.requested',
    jsonb_build_object('refundId', v_refund.id, 'invoiceId', v_invoice.id,
      'amountMinor', p_amount_minor, 'currency', 'TRY', 'kind', p_kind,
      'scope', v_scope, 'semanticVersion', 1),
    'subscription-refund-requested:' || v_refund.id
  );
  return v_after;
end;
$$;

alter function public.read_subscription_billing_settings(uuid)
  rename to read_subscription_billing_settings_before_refund_ledger;
revoke all on function public.read_subscription_billing_settings_before_refund_ledger(uuid)
  from public, anon, authenticated, service_role;

create function public.read_subscription_billing_settings(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb;
  v_refunds jsonb;
begin
  v_settings := public.read_subscription_billing_settings_before_refund_ledger(p_restaurant_id);
  select coalesce(jsonb_agg(refund_row order by "requestedAt" desc), '[]'::jsonb)
  into v_refunds from (
    select id, invoice_id as "invoiceId", kind, scope, amount_minor as "amountMinor",
      currency, status, requested_at as "requestedAt", completed_at as "completedAt"
    from public.subscription_refunds
    where restaurant_id = p_restaurant_id
    order by requested_at desc limit 12
  ) refund_row;
  return jsonb_set(v_settings, '{refunds}', v_refunds, true);
end;
$$;

revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;

revoke all on function public.prepare_platform_subscription_refund(
  uuid,uuid,uuid,text,text,bigint,text,text,uuid,text,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.prepare_platform_subscription_refund(
  uuid,uuid,uuid,text,text,bigint,text,text,uuid,text,text,timestamptz
) to service_role;

comment on table public.subscription_refunds is
  'Finance-only SaaS refund ledger. Reserved and uncertain amounts count against the paid invoice cap; refunds never mutate entitlements.';

commit;
