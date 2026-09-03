-- Refund access policy: full refunds may enqueue an immediate, multi-reference
-- provider cancellation. Money movement remains independent from paid invoice
-- history; access fails closed while provider cancellation is being verified.

begin;

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_status_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_status_check check (status in (
    'trial', 'trial_expired', 'active', 'past_due', 'grace_period',
    'suspended', 'refund_cancel_pending', 'cancelled', 'manual_hold'
  ));

alter table public.tenant_lifecycle_events
  drop constraint if exists tenant_lifecycle_events_from_status_check,
  drop constraint if exists tenant_lifecycle_events_to_status_check;
alter table public.tenant_lifecycle_events
  add constraint tenant_lifecycle_events_from_status_check check (
    from_status is null or from_status in (
      'trial', 'trial_expired', 'active', 'past_due', 'grace_period',
      'suspended', 'refund_cancel_pending', 'cancelled', 'manual_hold'
    )
  ),
  add constraint tenant_lifecycle_events_to_status_check check (
    to_status in (
      'trial', 'trial_expired', 'active', 'past_due', 'grace_period',
      'suspended', 'refund_cancel_pending', 'cancelled', 'manual_hold'
    )
  );

alter table public.subscription_refunds
  add column access_action text not null default 'keep',
  add column cancellation_request_id uuid;
update public.subscription_refunds
set access_action = 'cancel_immediately'
where kind = 'same_day_cancel';
alter table public.subscription_refunds
  add constraint subscription_refunds_access_action_check
    check (access_action in ('keep', 'cancel_immediately')),
  add constraint subscription_refunds_access_policy_check check (
    (kind <> 'same_day_cancel' or access_action = 'cancel_immediately')
    and (scope <> 'partial' or access_action = 'keep')
  );

alter table public.subscription_cancellation_requests
  add column mode text not null default 'period_end',
  add column source_refund_id uuid,
  add column superseded_at timestamptz,
  add column superseded_by_request_id uuid;
alter table public.subscription_cancellation_requests
  add constraint subscription_cancellation_requests_mode_check
    check (mode in ('period_end', 'immediate_refund')),
  add constraint subscription_cancellation_requests_source_refund_fk
    foreign key (source_refund_id) references public.subscription_refunds(id) on delete restrict,
  add constraint subscription_cancellation_requests_source_refund_key unique (source_refund_id),
  add constraint subscription_cancellation_requests_superseded_by_fk
    foreign key (superseded_by_request_id)
    references public.subscription_cancellation_requests(id) on delete restrict;
alter table public.subscription_refunds
  add constraint subscription_refunds_cancellation_request_fk
    foreign key (cancellation_request_id)
    references public.subscription_cancellation_requests(id) on delete restrict;

alter table public.subscription_cancellation_requests
  drop constraint if exists subscription_cancellation_requests_status_check,
  drop constraint if exists subscription_cancellation_requests_check;
alter table public.subscription_cancellation_requests
  add constraint subscription_cancellation_requests_status_check check (status in (
    'scheduled', 'processing', 'applied', 'withdrawn', 'superseded',
    'requires_reconciliation'
  )),
  add constraint subscription_cancellation_requests_state_check check (
    (status = 'scheduled' and locked_at is null and locked_by is null
      and applied_at is null and withdrawn_at is null and superseded_at is null)
    or (status = 'processing' and locked_at is not null and locked_by is not null
      and provider_operation_id is not null and applied_at is null
      and withdrawn_at is null and superseded_at is null)
    or (status = 'applied' and applied_at is not null
      and withdrawn_at is null and superseded_at is null)
    or (status = 'withdrawn' and withdrawn_at is not null and withdrawn_by is not null
      and withdrawal_idempotency_key is not null
      and withdrawal_request_fingerprint is not null
      and applied_at is null and superseded_at is null)
    or (status = 'superseded' and superseded_at is not null and applied_at is null)
    or (status = 'requires_reconciliation' and applied_at is null
      and withdrawn_at is null and superseded_at is null)
  );

create table public.subscription_cancellation_provider_targets (
  id uuid primary key default gen_random_uuid(),
  cancellation_request_id uuid not null
    references public.subscription_cancellation_requests(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid not null,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_subscription_ref text not null
    check (char_length(btrim(provider_subscription_ref)) between 1 and 200),
  status text not null check (status in (
    'scheduled', 'processing', 'applied', 'superseded', 'requires_reconciliation'
  )),
  provider_operation_id uuid unique
    references public.billing_provider_operations(id) on delete set null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text check (locked_by is null or char_length(btrim(locked_by)) between 1 and 160),
  provider_cancelled_at timestamptz,
  applied_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cancellation_request_id, provider_subscription_ref),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  check (
    (status = 'scheduled' and provider_operation_id is null and locked_at is null
      and locked_by is null and applied_at is null and provider_cancelled_at is null)
    or (status = 'processing' and provider_operation_id is not null
      and locked_at is not null and locked_by is not null and applied_at is null)
    or (status = 'applied' and provider_operation_id is not null
      and applied_at is not null and provider_cancelled_at is not null)
    or (status = 'superseded' and applied_at is null)
    or (status = 'requires_reconciliation' and applied_at is null)
  )
);
create index subscription_cancellation_provider_targets_due_idx
  on public.subscription_cancellation_provider_targets(status, next_attempt_at, created_at)
  where status = 'scheduled';
create trigger subscription_cancellation_provider_targets_updated_at
  before update on public.subscription_cancellation_provider_targets
  for each row execute function public.update_updated_at();
alter table public.subscription_cancellation_provider_targets enable row level security;
alter table public.subscription_cancellation_provider_targets force row level security;
revoke all on table public.subscription_cancellation_provider_targets from public, anon, authenticated;
grant select, insert, update on table public.subscription_cancellation_provider_targets to service_role;

insert into public.subscription_cancellation_provider_targets (
  cancellation_request_id, restaurant_id, subscription_id,
  provider_subscription_ref, status, next_attempt_at,
  provider_operation_id, attempts, locked_at, locked_by,
  provider_cancelled_at, applied_at, last_error
)
select request.id, request.restaurant_id, request.subscription_id,
  request.provider_subscription_ref,
  case request.status
    when 'applied' then 'applied'
    when 'withdrawn' then 'superseded'
    when 'superseded' then 'superseded'
    when 'requires_reconciliation' then 'requires_reconciliation'
    else request.status
  end,
  request.next_attempt_at, request.provider_operation_id, request.attempts,
  request.locked_at, request.locked_by,
  case when request.status = 'applied' then request.applied_at else null end,
  request.applied_at, request.last_error
from public.subscription_cancellation_requests request
on conflict (cancellation_request_id, provider_subscription_ref) do nothing;

create function public.seed_subscription_cancellation_provider_target()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.subscription_cancellation_provider_targets (
    cancellation_request_id, restaurant_id, subscription_id,
    provider_subscription_ref, status, next_attempt_at
  ) values (
    new.id, new.restaurant_id, new.subscription_id,
    new.provider_subscription_ref,
    case when new.status = 'requires_reconciliation'
      then 'requires_reconciliation' else 'scheduled' end,
    new.next_attempt_at
  ) on conflict (cancellation_request_id, provider_subscription_ref) do nothing;
  return new;
end;
$$;
create trigger seed_subscription_cancellation_provider_target
  after insert on public.subscription_cancellation_requests
  for each row execute function public.seed_subscription_cancellation_provider_target();

create function public.preserve_refund_cancellation_access_lock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'refund_cancel_pending' and new.status <> 'cancelled' then
    new.status := 'refund_cancel_pending';
    new.plan := old.plan;
    new.scheduled_plan := null;
    new.cancel_at_period_end := false;
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;
create trigger preserve_refund_cancellation_access_lock
  before update on public.billing_subscriptions
  for each row execute function public.preserve_refund_cancellation_access_lock();

create function public.enqueue_refund_subscription_cancellation(
  p_refund_id uuid,
  p_occurred_at timestamptz default clock_timestamp()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.subscription_refunds%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_existing public.subscription_cancellation_requests%rowtype;
  v_request public.subscription_cancellation_requests%rowtype;
  v_provider_ref text;
  v_conflict boolean := false;
  v_from text;
  v_fingerprint text;
begin
  if p_refund_id is null or p_occurred_at is null then
    raise exception 'refund_cancellation_input_invalid' using errcode = '22023';
  end if;
  select * into v_refund from public.subscription_refunds
  where id = p_refund_id for update;
  if not found or v_refund.status <> 'succeeded'
    or v_refund.access_action <> 'cancel_immediately' or v_refund.scope <> 'full' then
    raise exception 'refund_cancellation_not_eligible' using errcode = '55000';
  end if;
  select * into v_existing from public.subscription_cancellation_requests
  where source_refund_id = v_refund.id for update;
  if found then
    update public.subscription_refunds set cancellation_request_id = v_existing.id
    where id = v_refund.id and cancellation_request_id is null;
    return v_existing.id;
  end if;
  select * into v_subscription from public.billing_subscriptions
  where id = v_refund.subscription_id and restaurant_id = v_refund.restaurant_id for update;
  if not found or v_subscription.provider <> 'iyzico' then
    raise exception 'refund_cancellation_subscription_mismatch' using errcode = 'P0001';
  end if;

  v_conflict := exists (
    select 1 from public.subscription_change_requests change
    where change.subscription_id = v_subscription.id
      and change.status in ('processing', 'paid_pending', 'paid_draining', 'requires_reconciliation')
  ) or exists (
    select 1 from public.subscription_cancellation_requests cancellation
    where cancellation.subscription_id = v_subscription.id
      and cancellation.status in ('processing', 'requires_reconciliation')
  );

  select coalesce((
    select ref.provider_subscription_ref
    from public.billing_subscription_provider_refs ref
    where ref.subscription_id = v_subscription.id and ref.ref_role = 'current'
      and ref.retired_at is null
    order by ref.updated_at desc limit 1
  ), v_subscription.provider_subscription_ref) into v_provider_ref;
  if v_provider_ref is null then v_conflict := true; v_provider_ref := 'missing:' || v_subscription.id; end if;
  v_fingerprint := encode(extensions.digest(convert_to(
    v_refund.restaurant_id::text || E'\n' || v_refund.subscription_id::text || E'\n'
      || v_refund.id::text || E'\n' || v_provider_ref, 'utf8'), 'sha256'), 'hex');

  update public.subscription_cancellation_requests
  set status = 'superseded', superseded_at = p_occurred_at,
      locked_at = null, locked_by = null
  where subscription_id = v_subscription.id
    and status in ('scheduled', 'processing', 'requires_reconciliation');
  update public.subscription_cancellation_provider_targets target
  set status = 'superseded', locked_at = null, locked_by = null
  from public.subscription_cancellation_requests old_request
  where target.cancellation_request_id = old_request.id
    and old_request.subscription_id = v_subscription.id
    and old_request.status = 'superseded'
    and target.status in ('scheduled', 'processing', 'requires_reconciliation');

  insert into public.subscription_cancellation_requests (
    restaurant_id, subscription_id, status, effective_at,
    provider_subscription_ref, idempotency_key, request_fingerprint,
    requested_by, scheduled_at, next_attempt_at, mode, source_refund_id,
    last_error
  ) values (
    v_refund.restaurant_id, v_refund.subscription_id,
    case when v_conflict then 'requires_reconciliation' else 'scheduled' end,
    p_occurred_at, v_provider_ref, 'billing:refund-cancel:' || v_refund.id,
    v_fingerprint, v_refund.requested_by, p_occurred_at, p_occurred_at,
    'immediate_refund', v_refund.id,
    case when v_conflict then 'refund_cancellation_conflicts_with_inflight_change' else null end
  ) returning * into v_request;

  update public.subscription_cancellation_requests
  set superseded_by_request_id = v_request.id
  where subscription_id = v_subscription.id and id <> v_request.id
    and status = 'superseded' and superseded_by_request_id is null;

  update public.subscription_change_requests
  set status = 'cancelled', cancelled_at = coalesce(cancelled_at, p_occurred_at),
      last_error = 'superseded_by_immediate_refund_cancellation'
  where subscription_id = v_subscription.id and status = 'scheduled';

  insert into public.subscription_cancellation_provider_targets (
    cancellation_request_id, restaurant_id, subscription_id,
    provider_subscription_ref, status, next_attempt_at, last_error
  )
  select distinct v_request.id, v_refund.restaurant_id, v_refund.subscription_id,
    refs.provider_subscription_ref,
    case when v_conflict then 'requires_reconciliation' else 'scheduled' end,
    p_occurred_at,
    case when v_conflict then 'refund_cancellation_conflicts_with_inflight_change' else null end
  from (
    select ref.provider_subscription_ref
    from public.billing_subscription_provider_refs ref
    where ref.subscription_id = v_subscription.id
      and ref.ref_role in ('current', 'scheduled') and ref.retired_at is null
    union
    select v_subscription.provider_subscription_ref
    where v_subscription.provider_subscription_ref is not null
  ) refs
  on conflict (cancellation_request_id, provider_subscription_ref) do update
    set status = excluded.status, next_attempt_at = excluded.next_attempt_at,
        last_error = excluded.last_error;

  v_from := v_subscription.status;
  update public.billing_subscriptions
  set status = 'refund_cancel_pending', scheduled_plan = null,
      cancel_at_period_end = false, version = version + 1
  where id = v_subscription.id and status <> 'cancelled';
  update public.subscription_refunds
  set cancellation_request_id = v_request.id where id = v_refund.id;
  insert into public.tenant_lifecycle_events (
    restaurant_id, subscription_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, request_id, occurred_at
  ) values (
    v_refund.restaurant_id, v_refund.subscription_id, v_from,
    'refund_cancel_pending', 'platform_admin', v_refund.requested_by,
    'refund_cancel_pending', 'billing:refund-cancel-pending:' || v_refund.id,
    p_occurred_at
  ) on conflict (request_id) do nothing;
  return v_request.id;
end;
$$;

drop function if exists public.prepare_platform_subscription_refund(
  uuid,uuid,uuid,text,text,bigint,text,text,uuid,text,text,timestamptz
);
create function public.prepare_platform_subscription_refund(
  p_restaurant_id uuid,
  p_invoice_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_kind text,
  p_access_action text,
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
  v_available bigint;
  v_scope text;
  v_after jsonb;
begin
  if p_restaurant_id is null or p_invoice_id is null or p_actor_user_id is null
    or p_request_id is null or p_occurred_at is null
    or p_kind not in ('same_day_cancel', 'refund')
    or p_access_action not in ('keep', 'cancel_immediately')
    or (p_kind = 'same_day_cancel' and p_access_action <> 'cancel_immediately')
    or p_amount_minor <= 0
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
    if v_existing.restaurant_id <> p_restaurant_id or v_existing.invoice_id <> p_invoice_id
      or v_existing.requested_by <> p_actor_user_id or v_existing.request_id <> p_request_id
      or v_existing.request_fingerprint <> p_request_fingerprint or v_existing.kind <> p_kind
      or v_existing.access_action <> p_access_action
      or v_existing.amount_minor <> p_amount_minor or v_existing.reason_code <> p_reason_code
      or v_existing.reason_detail <> btrim(p_reason_detail) then
      raise exception 'subscription_refund_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'refundId', v_existing.id, 'operationId', v_existing.provider_operation_id,
      'restaurantId', v_existing.restaurant_id, 'subscriptionId', v_existing.subscription_id,
      'invoiceId', v_existing.invoice_id, 'providerPaymentId', v_existing.provider_payment_id,
      'kind', v_existing.kind, 'scope', v_existing.scope,
      'accessAction', v_existing.access_action,
      'amountMinor', v_existing.amount_minor, 'currency', v_existing.currency,
      'status', v_existing.status, 'providerRefundRef', v_existing.provider_refund_ref,
      'cancellationRequestId', v_existing.cancellation_request_id,
      'cancellationStatus', (select status from public.subscription_cancellation_requests
        where id = v_existing.cancellation_request_id),
      'dispatchable', false, 'duplicate', true
    );
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id and deleted_at is null for update;
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
  order by completed_at desc nulls last limit 1 for update;
  if not found or v_attempt.provider_payment_id is null then
    raise exception 'subscription_refund_payment_identity_missing' using errcode = '55000';
  end if;
  select coalesce(sum(amount_minor), 0) into v_reserved
  from public.subscription_refunds where invoice_id = v_invoice.id
    and status in ('requested', 'processing', 'succeeded', 'requires_reconciliation');
  v_available := v_invoice.amount_paid_minor - v_reserved;
  if p_amount_minor > v_available then
    raise exception 'subscription_refund_amount_exceeds_available' using errcode = '22003';
  end if;
  v_scope := case when p_amount_minor = v_available then 'full' else 'partial' end;
  if v_scope = 'partial' and p_access_action = 'cancel_immediately' then
    raise exception 'subscription_partial_refund_cannot_cancel_access' using errcode = '22023';
  end if;
  if p_kind = 'same_day_cancel' and (
    v_reserved <> 0 or p_amount_minor <> v_invoice.amount_paid_minor
    or (v_invoice.paid_at at time zone 'Europe/Istanbul')::date
      <> (p_occurred_at at time zone 'Europe/Istanbul')::date
  ) then
    raise exception 'subscription_same_day_cancel_not_eligible' using errcode = '55000';
  end if;
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
    provider_payment_id, provider_operation_id, kind, scope, access_action,
    amount_minor, reason_code, reason_detail, status, idempotency_key,
    request_fingerprint, request_id, requested_by, requested_at
  ) values (
    p_restaurant_id, v_subscription.id, v_invoice.id, v_attempt.id,
    v_attempt.provider_payment_id, v_operation.id, p_kind, v_scope, p_access_action,
    p_amount_minor, p_reason_code, btrim(p_reason_detail), 'processing',
    btrim(p_idempotency_key), p_request_fingerprint, p_request_id,
    p_actor_user_id, p_occurred_at
  ) returning * into v_refund;
  v_after := jsonb_build_object(
    'refundId', v_refund.id, 'operationId', v_operation.id,
    'restaurantId', p_restaurant_id, 'subscriptionId', v_subscription.id,
    'invoiceId', v_invoice.id, 'providerPaymentId', v_attempt.provider_payment_id,
    'kind', p_kind, 'scope', v_scope, 'accessAction', p_access_action,
    'amountMinor', p_amount_minor, 'currency', 'TRY', 'status', 'processing',
    'providerRefundRef', null, 'cancellationRequestId', null,
    'cancellationStatus', null, 'dispatchable', true, 'duplicate', false
  );
  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_actor_user_id, v_identity.role, 'billing.subscription_refund.request',
    'billing_invoice', v_invoice.id::text, btrim(p_reason_detail), p_request_id,
    jsonb_build_object('restaurantId', p_restaurant_id, 'invoiceId', v_invoice.id,
      'paidMinor', v_invoice.amount_paid_minor, 'reservedMinor', v_reserved,
      'refundableMinor', v_available), v_after - 'providerPaymentId'
  );
  perform public.enqueue_domain_outbox_event(
    p_restaurant_id, 'billing_refund', v_refund.id, 'refund.requested',
    jsonb_build_object('refundId', v_refund.id, 'invoiceId', v_invoice.id,
      'amountMinor', p_amount_minor, 'currency', 'TRY', 'kind', p_kind,
      'scope', v_scope, 'accessAction', p_access_action, 'semanticVersion', 2),
    'subscription-refund-requested:' || v_refund.id
  );
  return v_after;
end;
$$;

create or replace function public.complete_platform_subscription_refund(
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
  v_refund public.subscription_refunds%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_cancellation_id uuid;
  v_cancellation_status text;
begin
  if p_refund_id is null or p_operation_id is null or p_amount_minor <= 0 or p_occurred_at is null
    or coalesce(char_length(btrim(p_provider_payment_id)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_refund_ref)), 0) not between 1 and 200 then
    raise exception 'subscription_refund_completion_input_invalid' using errcode = '22023';
  end if;
  select * into v_refund from public.subscription_refunds where id = p_refund_id for update;
  if not found or v_refund.provider_operation_id <> p_operation_id
    or v_refund.provider_payment_id <> btrim(p_provider_payment_id)
    or v_refund.amount_minor <> p_amount_minor then
    raise exception 'subscription_refund_completion_mismatch' using errcode = 'P0001';
  end if;
  if v_refund.status = 'succeeded' then
    if v_refund.provider_refund_ref <> btrim(p_provider_refund_ref) then
      raise exception 'subscription_refund_completion_conflict' using errcode = 'P0001';
    end if;
    select status into v_cancellation_status from public.subscription_cancellation_requests
    where id = v_refund.cancellation_request_id;
    return jsonb_build_object(
      'refundId', v_refund.id, 'operationId', v_refund.provider_operation_id,
      'restaurantId', v_refund.restaurant_id, 'subscriptionId', v_refund.subscription_id,
      'invoiceId', v_refund.invoice_id, 'kind', v_refund.kind, 'scope', v_refund.scope,
      'accessAction', v_refund.access_action, 'amountMinor', v_refund.amount_minor,
      'currency', v_refund.currency, 'status', v_refund.status,
      'providerRefundRef', v_refund.provider_refund_ref,
      'cancellationRequestId', v_refund.cancellation_request_id,
      'cancellationStatus', v_cancellation_status,
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
        'kind', v_refund.kind, 'scope', v_refund.scope,
        'accessAction', v_refund.access_action
      )
  where id = v_operation.id;
  if v_refund.access_action = 'cancel_immediately' then
    v_cancellation_id := public.enqueue_refund_subscription_cancellation(v_refund.id, p_occurred_at);
    select * into v_refund from public.subscription_refunds where id = v_refund.id;
    select status into v_cancellation_status from public.subscription_cancellation_requests
    where id = v_cancellation_id;
  end if;
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
      'kind', v_refund.kind, 'scope', v_refund.scope,
      'accessAction', v_refund.access_action, 'semanticVersion', 2),
    'subscription-refund-succeeded:' || v_refund.id
  );
  return jsonb_build_object(
    'refundId', v_refund.id, 'operationId', v_refund.provider_operation_id,
    'restaurantId', v_refund.restaurant_id, 'subscriptionId', v_refund.subscription_id,
    'invoiceId', v_refund.invoice_id, 'kind', v_refund.kind, 'scope', v_refund.scope,
    'accessAction', v_refund.access_action, 'amountMinor', v_refund.amount_minor,
    'currency', v_refund.currency, 'status', v_refund.status,
    'providerRefundRef', v_refund.provider_refund_ref,
    'cancellationRequestId', v_refund.cancellation_request_id,
    'cancellationStatus', v_cancellation_status,
    'dispatchable', false, 'duplicate', false
  );
end;
$$;

create or replace function public.fail_platform_subscription_refund(
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
  v_refund public.subscription_refunds%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_status text;
  v_reconciliation public.billing_reconciliation_jobs%rowtype;
begin
  if p_refund_id is null or p_operation_id is null or p_requires_reconciliation is null
    or p_occurred_at is null
    or coalesce(char_length(btrim(p_failure_code)), 0) not between 1 and 100 then
    raise exception 'subscription_refund_failure_input_invalid' using errcode = '22023';
  end if;
  select * into v_refund from public.subscription_refunds where id = p_refund_id for update;
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
      'accessAction', v_refund.access_action, 'amountMinor', v_refund.amount_minor,
      'currency', v_refund.currency, 'status', v_refund.status,
      'providerRefundRef', null, 'cancellationRequestId', v_refund.cancellation_request_id,
      'cancellationStatus', null, 'dispatchable', false, 'duplicate', true
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
      scheduled_at, local_snapshot, provider_snapshot_sanitized,
      discrepancy_code, last_error
    ) values (
      v_refund.restaurant_id, v_refund.subscription_id, 'iyzico', 'invoice',
      'subscription-refund:' || v_refund.id, 'discrepancy', p_occurred_at,
      jsonb_build_object('refundId', v_refund.id, 'invoiceId', v_refund.invoice_id,
        'operationId', v_refund.provider_operation_id, 'amountMinor', v_refund.amount_minor,
        'currency', v_refund.currency, 'status', v_refund.status,
        'accessAction', v_refund.access_action),
      '{}'::jsonb, 'subscription_refund_provider_uncertain', btrim(p_failure_code)
    ) on conflict (dedupe_key) do update set status = 'discrepancy', completed_at = null,
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
        'kind', v_refund.kind, 'scope', v_refund.scope,
        'accessAction', v_refund.access_action, 'semanticVersion', 2),
      'subscription-refund-failed:' || v_refund.id
    );
  end if;
  return jsonb_build_object(
    'refundId', v_refund.id, 'operationId', v_refund.provider_operation_id,
    'restaurantId', v_refund.restaurant_id, 'subscriptionId', v_refund.subscription_id,
    'invoiceId', v_refund.invoice_id, 'kind', v_refund.kind, 'scope', v_refund.scope,
    'accessAction', v_refund.access_action, 'amountMinor', v_refund.amount_minor,
    'currency', v_refund.currency, 'status', v_refund.status,
    'providerRefundRef', null, 'cancellationRequestId', v_refund.cancellation_request_id,
    'cancellationStatus', null, 'dispatchable', false, 'duplicate', false
  );
end;
$$;

drop function if exists public.complete_scheduled_subscription_cancellation(
  uuid,uuid,text,timestamptz,timestamptz
);
drop function if exists public.fail_scheduled_subscription_cancellation(uuid,uuid,text,text);

create or replace function public.claim_due_subscription_cancellations(
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
  v_target public.subscription_cancellation_provider_targets%rowtype;
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
  for v_target in
    select target.* from public.subscription_cancellation_provider_targets target
    where target.status = 'processing'
      and target.locked_at < p_occurred_at - make_interval(secs => p_lease_seconds)
    order by target.locked_at for update skip locked
  loop
    update public.billing_provider_operations set status = 'requires_reconciliation',
      last_error = 'stale_subscription_cancellation_target_claim'
    where id = v_target.provider_operation_id and status = 'processing';
    update public.subscription_cancellation_provider_targets
    set status = 'requires_reconciliation', locked_at = null, locked_by = null,
      last_error = 'stale_subscription_cancellation_target_claim'
    where id = v_target.id;
    update public.subscription_cancellation_requests
    set status = 'requires_reconciliation', locked_at = null, locked_by = null,
      last_error = 'stale_subscription_cancellation_target_claim'
    where id = v_target.cancellation_request_id and status <> 'applied';
    insert into public.billing_reconciliation_jobs (
      restaurant_id, subscription_id, provider, scope, dedupe_key,
      local_snapshot, provider_snapshot_sanitized, discrepancy_code, last_error
    ) values (
      v_target.restaurant_id, v_target.subscription_id, 'iyzico', 'subscription',
      'cancellation-target:' || v_target.id,
      jsonb_build_object('cancellationTargetId', v_target.id,
        'cancellationRequestId', v_target.cancellation_request_id),
      '{}'::jsonb, 'subscription_cancellation_result_ambiguous',
      'stale_subscription_cancellation_target_claim'
    ) on conflict (dedupe_key) do nothing;
  end loop;
  for v_target in
    select target.* from public.subscription_cancellation_provider_targets target
    join public.subscription_cancellation_requests request
      on request.id = target.cancellation_request_id
    where target.status = 'scheduled' and target.next_attempt_at <= p_occurred_at
      and request.status in ('scheduled', 'processing')
      and request.effective_at <= p_occurred_at
    order by request.effective_at, target.created_at
    for update of target skip locked limit p_limit
  loop
    select * into v_request from public.subscription_cancellation_requests
    where id = v_target.cancellation_request_id for update;
    select * into v_subscription from public.billing_subscriptions
    where id = v_target.subscription_id and restaurant_id = v_target.restaurant_id for update;
    select * into v_customer from public.billing_customers
    where id = v_subscription.billing_customer_id and restaurant_id = v_target.restaurant_id;
    if v_subscription.id is null or v_customer.id is null or v_subscription.status = 'cancelled'
      or v_subscription.provider <> 'iyzico'
      or (v_request.mode = 'immediate_refund' and v_subscription.status <> 'refund_cancel_pending')
      or (v_request.mode = 'period_end' and not v_subscription.cancel_at_period_end) then
      update public.subscription_cancellation_provider_targets
      set status = 'requires_reconciliation', last_error = 'subscription_cancellation_context_drift'
      where id = v_target.id;
      update public.subscription_cancellation_requests
      set status = 'requires_reconciliation', locked_at = null, locked_by = null,
        last_error = 'subscription_cancellation_context_drift'
      where id = v_request.id;
      continue;
    end if;
    v_fingerprint := encode(extensions.digest(convert_to(
      v_target.restaurant_id::text || E'\n' || v_target.subscription_id::text || E'\n'
      || v_target.id::text || E'\n' || v_target.provider_subscription_ref, 'utf8'), 'sha256'), 'hex');
    insert into public.billing_provider_operations (
      restaurant_id, billing_customer_id, subscription_id, operation_type,
      idempotency_key, request_fingerprint, status, provider_subscription_ref
    ) values (
      v_target.restaurant_id, v_customer.id, v_target.subscription_id,
      'subscription.cancel', 'billing:cancellation-target:' || v_target.id,
      v_fingerprint, 'processing', v_target.provider_subscription_ref
    ) returning * into v_operation;
    update public.subscription_cancellation_provider_targets
    set status = 'processing', provider_operation_id = v_operation.id,
      attempts = attempts + 1, locked_at = p_occurred_at,
      locked_by = btrim(p_worker), last_error = null
    where id = v_target.id returning * into v_target;
    update public.subscription_cancellation_requests
    set status = 'processing', provider_operation_id = v_operation.id,
      attempts = attempts + 1, locked_at = p_occurred_at,
      locked_by = btrim(p_worker), last_error = null
    where id = v_request.id;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'cancellationRequestId', v_request.id, 'cancellationTargetId', v_target.id,
      'cancellationMode', v_request.mode, 'operationId', v_operation.id,
      'restaurantId', v_target.restaurant_id, 'subscriptionId', v_target.subscription_id,
      'providerSubscriptionRef', v_target.provider_subscription_ref,
      'effectiveAt', v_request.effective_at, 'attempts', v_target.attempts
    ));
  end loop;
  return v_results;
end;
$$;

create function public.complete_subscription_cancellation_target(
  p_cancellation_request_id uuid,
  p_cancellation_target_id uuid,
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
  v_target public.subscription_cancellation_provider_targets%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_from text;
  v_reason text;
  v_remaining integer;
begin
  if p_cancellation_request_id is null or p_cancellation_target_id is null
    or p_operation_id is null
    or char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or p_provider_cancelled_at is null or p_occurred_at is null then
    raise exception 'billing_cancellation_complete_input_invalid' using errcode = '22023';
  end if;
  select * into v_request from public.subscription_cancellation_requests
  where id = p_cancellation_request_id for update;
  select * into v_target from public.subscription_cancellation_provider_targets
  where id = p_cancellation_target_id and cancellation_request_id = p_cancellation_request_id
  for update;
  if not found then raise exception 'billing_cancellation_target_not_found' using errcode = 'P0002'; end if;
  if v_target.status = 'applied' then
    return jsonb_build_object('cancellationRequestId', v_request.id,
      'subscriptionId', v_request.subscription_id, 'status', v_request.status,
      'requestCompleted', v_request.status = 'applied', 'duplicate', true);
  end if;
  if v_request.status <> 'processing' or v_target.status <> 'processing'
    or v_target.provider_operation_id <> p_operation_id
    or v_target.locked_by <> btrim(p_worker) then
    raise exception 'billing_cancellation_completion_lease_lost' using errcode = '55P03';
  end if;
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.cancel'
    and subscription_id = v_request.subscription_id
    and restaurant_id = v_request.restaurant_id for update;
  if not found or v_operation.status <> 'processing'
    or v_operation.provider_subscription_ref <> v_target.provider_subscription_ref then
    raise exception 'billing_cancellation_completion_context_invalid' using errcode = 'P0001';
  end if;
  update public.billing_provider_operations set status = 'succeeded',
    result_sanitized = jsonb_build_object('cancelledAt', p_provider_cancelled_at),
    completed_at = p_occurred_at, last_error = null where id = v_operation.id;
  update public.subscription_cancellation_provider_targets
  set status = 'applied', provider_cancelled_at = p_provider_cancelled_at,
    applied_at = p_occurred_at, locked_at = null, locked_by = null, last_error = null
  where id = v_target.id;
  select count(*) into v_remaining from public.subscription_cancellation_provider_targets
  where cancellation_request_id = v_request.id and status <> 'applied';
  if v_remaining > 0 then
    update public.subscription_cancellation_requests
    set status = 'processing', locked_at = p_occurred_at, locked_by = btrim(p_worker)
    where id = v_request.id;
    return jsonb_build_object('cancellationRequestId', v_request.id,
      'subscriptionId', v_request.subscription_id, 'status', 'processing',
      'requestCompleted', false, 'duplicate', false);
  end if;
  select * into v_subscription from public.billing_subscriptions
  where id = v_request.subscription_id and restaurant_id = v_request.restaurant_id for update;
  if not found then raise exception 'billing_cancellation_subscription_not_found' using errcode = 'P0002'; end if;
  v_from := v_subscription.status;
  v_reason := case when v_request.mode = 'immediate_refund'
    then 'refund_cancelled_immediately' else 'tenant_cancelled_period_end' end;
  update public.billing_subscriptions
  set status = 'cancelled', cancelled_at = p_provider_cancelled_at,
    cancel_at_period_end = false, scheduled_plan = null, version = version + 1
  where id = v_subscription.id;
  update public.restaurants set plan = 'starter' where id = v_request.restaurant_id;
  update public.restaurant_subscription_add_ons
  set status = 'cancelled', cancelled_at = coalesce(cancelled_at, p_occurred_at)
  where restaurant_id = v_request.restaurant_id and subscription_id = v_request.subscription_id
    and status = 'active';
  update public.billing_subscription_provider_refs
  set ref_role = 'previous', retired_at = coalesce(retired_at, p_occurred_at)
  where subscription_id = v_request.subscription_id and retired_at is null;
  update public.subscription_cancellation_requests
  set status = 'applied', applied_at = p_occurred_at,
    locked_at = null, locked_by = null, last_error = null
  where id = v_request.id;
  insert into public.tenant_lifecycle_events (
    restaurant_id, subscription_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, request_id, occurred_at
  ) values (
    v_request.restaurant_id, v_request.subscription_id, v_from, 'cancelled',
    'system', v_request.requested_by, v_reason,
    'billing:subscription-cancelled:' || v_request.id, p_occurred_at
  ) on conflict (request_id) do nothing;
  perform public.enqueue_domain_outbox_event(
    v_request.restaurant_id, 'billing_subscription', v_request.id,
    'subscription.cancelled',
    jsonb_build_object('subscriptionId', v_request.subscription_id,
      'cancellationRequestId', v_request.id, 'mode', v_request.mode,
      'effectiveAt', v_request.effective_at, 'cancelledAt', p_provider_cancelled_at,
      'semanticVersion', 2),
    'billing:subscription-cancelled:v2:' || v_request.id
  );
  perform public.enqueue_domain_outbox_event(
    v_request.restaurant_id, 'billing_subscription', v_request.subscription_id,
    'subscription.status_changed',
    jsonb_build_object('from', v_from, 'to', 'cancelled', 'reasonCode', v_reason),
    'billing:subscription-cancel-status:v2:' || v_request.id
  );
  return jsonb_build_object('cancellationRequestId', v_request.id,
    'subscriptionId', v_request.subscription_id, 'status', 'applied',
    'requestCompleted', true, 'duplicate', false);
end;
$$;

create function public.fail_subscription_cancellation_target(
  p_cancellation_request_id uuid,
  p_cancellation_target_id uuid,
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
  v_target public.subscription_cancellation_provider_targets%rowtype;
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_reason, ''))) not between 1 and 1000 then
    raise exception 'billing_cancellation_failure_input_invalid' using errcode = '22023';
  end if;
  select * into v_target from public.subscription_cancellation_provider_targets
  where id = p_cancellation_target_id and cancellation_request_id = p_cancellation_request_id
  for update;
  if found and v_target.status = 'requires_reconciliation'
    and v_target.provider_operation_id = p_operation_id then return true; end if;
  if not found or v_target.status <> 'processing'
    or v_target.provider_operation_id <> p_operation_id
    or v_target.locked_by <> btrim(p_worker) then
    raise exception 'billing_cancellation_failure_lease_lost' using errcode = '55P03';
  end if;
  update public.billing_provider_operations
  set status = 'requires_reconciliation', last_error = left(btrim(p_reason), 1000)
  where id = p_operation_id and status = 'processing';
  update public.subscription_cancellation_provider_targets
  set status = 'requires_reconciliation', locked_at = null, locked_by = null,
    last_error = left(btrim(p_reason), 1000)
  where id = v_target.id;
  update public.subscription_cancellation_requests
  set status = 'requires_reconciliation', locked_at = null, locked_by = null,
    last_error = left(btrim(p_reason), 1000)
  where id = p_cancellation_request_id;
  insert into public.billing_reconciliation_jobs (
    restaurant_id, subscription_id, provider, scope, dedupe_key,
    local_snapshot, provider_snapshot_sanitized, discrepancy_code, last_error
  ) values (
    v_target.restaurant_id, v_target.subscription_id, 'iyzico', 'subscription',
    'cancellation-target:' || v_target.id,
    jsonb_build_object('cancellationTargetId', v_target.id,
      'cancellationRequestId', p_cancellation_request_id),
    '{}'::jsonb, 'subscription_cancellation_result_ambiguous',
    left(btrim(p_reason), 1000)
  ) on conflict (dedupe_key) do nothing;
  perform public.enqueue_domain_outbox_event(
    v_target.restaurant_id, 'billing_reconciliation', v_target.id,
    'billing.reconciliation_required',
    jsonb_build_object('scope', 'subscription',
      'subscriptionId', v_target.subscription_id,
      'cancellationRequestId', p_cancellation_request_id,
      'cancellationTargetId', v_target.id, 'semanticVersion', 1),
    'subscription-cancellation-reconciliation:' || v_target.id
  );
  return true;
end;
$$;

alter function public.read_subscription_billing_settings(uuid)
  rename to read_subscription_billing_settings_before_refund_access_cancellation;
revoke all on function public.read_subscription_billing_settings_before_refund_access_cancellation(uuid)
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
  v_settings := public.read_subscription_billing_settings_before_refund_access_cancellation(p_restaurant_id);
  select coalesce(jsonb_agg(refund_row order by "requestedAt" desc), '[]'::jsonb)
  into v_refunds from (
    select refund.id, refund.invoice_id as "invoiceId", refund.kind, refund.scope,
      refund.access_action as "accessAction", refund.amount_minor as "amountMinor",
      refund.currency, refund.status, refund.requested_at as "requestedAt",
      refund.completed_at as "completedAt",
      refund.cancellation_request_id as "cancellationRequestId",
      cancellation.status as "cancellationStatus"
    from public.subscription_refunds refund
    left join public.subscription_cancellation_requests cancellation
      on cancellation.id = refund.cancellation_request_id
    where refund.restaurant_id = p_restaurant_id
    order by refund.requested_at desc limit 12
  ) refund_row;
  return jsonb_set(v_settings, '{refunds}', v_refunds, true);
end;
$$;

alter function public.read_platform_admin_tenant_billing_timeline(uuid,uuid,text,integer)
  rename to read_platform_admin_tenant_billing_timeline_before_refund_access;
revoke all on function public.read_platform_admin_tenant_billing_timeline_before_refund_access(uuid,uuid,text,integer)
  from public, anon, authenticated, service_role;
create function public.read_platform_admin_tenant_billing_timeline(
  p_restaurant_id uuid, p_actor_user_id uuid, p_actor_role text, p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base jsonb;
  v_refunds jsonb;
  v_items jsonb;
begin
  v_base := public.read_platform_admin_tenant_billing_timeline_before_refund_access(
    p_restaurant_id, p_actor_user_id, p_actor_role, p_limit
  );
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', refund.id, 'kind', 'refund', 'status', refund.status,
    'action', refund.kind, 'occurredAt', refund.requested_at,
    'invoiceId', refund.invoice_id, 'amountMinor', refund.amount_minor,
    'currency', refund.currency, 'attempt', null, 'nextActionAt', null,
    'completedAt', refund.completed_at,
    'hasError', refund.status in ('failed', 'requires_reconciliation'),
    'accessAction', refund.access_action,
    'cancellationStatus', cancellation.status
  ) order by refund.requested_at desc), '[]'::jsonb)
  into v_refunds
  from public.subscription_refunds refund
  left join public.subscription_cancellation_requests cancellation
    on cancellation.id = refund.cancellation_request_id
  where refund.restaurant_id = p_restaurant_id;
  select coalesce(jsonb_agg(item order by item->>'occurredAt' desc), '[]'::jsonb)
  into v_items from (
    select value as item from jsonb_array_elements((v_base->'items') || v_refunds)
    order by value->>'occurredAt' desc limit p_limit
  ) combined;
  v_base := jsonb_set(v_base, '{items}', v_items, true);
  v_base := jsonb_set(v_base, '{summary,refundedMinor}', to_jsonb(coalesce((
    select sum(amount_minor) from public.subscription_refunds
    where restaurant_id = p_restaurant_id and status = 'succeeded'
  ), 0)), true);
  return v_base;
end;
$$;

-- Forward-only, provider-call-free backfill. The helper is idempotent by
-- source_refund_id and creates exactly one request plus unique provider targets.
do $$
declare
  v_refund record;
begin
  for v_refund in
    select refund.id from public.subscription_refunds refund
    join public.billing_subscriptions subscription on subscription.id = refund.subscription_id
    where refund.kind = 'same_day_cancel' and refund.status = 'succeeded'
      and refund.scope = 'full' and subscription.status <> 'cancelled'
    order by refund.completed_at, refund.id
  loop
    perform public.enqueue_refund_subscription_cancellation(
      v_refund.id, coalesce((select completed_at from public.subscription_refunds where id = v_refund.id), clock_timestamp())
    );
  end loop;
end;
$$;

revoke all on function public.seed_subscription_cancellation_provider_target()
  from public, anon, authenticated;
revoke all on function public.preserve_refund_cancellation_access_lock()
  from public, anon, authenticated;
revoke all on function public.enqueue_refund_subscription_cancellation(uuid,timestamptz)
  from public, anon, authenticated;
revoke all on function public.prepare_platform_subscription_refund(
  uuid,uuid,uuid,text,text,text,bigint,text,text,uuid,text,text,timestamptz
) from public, anon, authenticated;
revoke all on function public.complete_platform_subscription_refund(
  uuid,uuid,text,text,bigint,timestamptz
) from public, anon, authenticated;
revoke all on function public.fail_platform_subscription_refund(
  uuid,uuid,text,boolean,timestamptz
) from public, anon, authenticated;
revoke all on function public.claim_due_subscription_cancellations(text,integer,integer,timestamptz)
  from public, anon, authenticated;
revoke all on function public.complete_subscription_cancellation_target(
  uuid,uuid,uuid,text,timestamptz,timestamptz
) from public, anon, authenticated;
revoke all on function public.fail_subscription_cancellation_target(uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;
revoke all on function public.read_platform_admin_tenant_billing_timeline(uuid,uuid,text,integer)
  from public, anon, authenticated;

grant execute on function public.prepare_platform_subscription_refund(
  uuid,uuid,uuid,text,text,text,bigint,text,text,uuid,text,text,timestamptz
) to service_role;
grant execute on function public.complete_platform_subscription_refund(
  uuid,uuid,text,text,bigint,timestamptz
) to service_role;
grant execute on function public.fail_platform_subscription_refund(
  uuid,uuid,text,boolean,timestamptz
) to service_role;
grant execute on function public.claim_due_subscription_cancellations(text,integer,integer,timestamptz)
  to service_role;
grant execute on function public.complete_subscription_cancellation_target(
  uuid,uuid,uuid,text,timestamptz,timestamptz
) to service_role;
grant execute on function public.fail_subscription_cancellation_target(uuid,uuid,uuid,text,text)
  to service_role;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;
grant execute on function public.read_platform_admin_tenant_billing_timeline(uuid,uuid,text,integer)
  to service_role;

comment on table public.subscription_cancellation_provider_targets is
  'Every current or scheduled iyzico subscription reference that must be verifiably cancelled before local access becomes cancelled.';
comment on table public.subscription_refunds is
  'Finance refund ledger with explicit access policy; partial refunds always keep access and immediate cancellation is provider-verified.';

commit;
