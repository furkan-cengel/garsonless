-- Faz 3a: durable same-interval subscription plan-change requests.
-- Provider upgrade acceptance schedules a change; it is never payment
-- evidence and cannot activate/deactivate plan entitlements by itself.

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
    'plan.change_scheduled', 'plan.changed',
    'tenant.suspended', 'tenant.reactivated'
  ));

create table public.subscription_change_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subscription_id uuid not null,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  change_kind text not null check (change_kind in (
    'upgrade', 'downgrade', 'interval_change', 'add_on_add', 'add_on_remove'
  )),
  from_plan text not null check (from_plan in ('starter', 'plus', 'pro')),
  to_plan text not null check (to_plan in ('starter', 'plus', 'pro')),
  from_billing_interval text not null check (from_billing_interval in ('monthly', 'annual')),
  to_billing_interval text not null check (to_billing_interval in ('monthly', 'annual')),
  from_add_ons text[] not null default '{}'::text[],
  to_add_ons text[] not null default '{}'::text[],
  effective_policy text not null check (effective_policy in ('now', 'next_period')),
  effective_at timestamptz not null,
  status text not null check (status in (
    'processing', 'scheduled', 'applied', 'cancelled',
    'requires_reconciliation', 'failed'
  )),
  provider_parent_subscription_ref text not null,
  provider_target_subscription_ref text,
  provider_target_plan_ref text not null,
  provider_operation_id uuid unique,
  idempotency_key text not null unique check (char_length(btrim(idempotency_key)) between 1 and 160),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  requested_by uuid not null references auth.users(id) on delete restrict,
  provider_result_sanitized jsonb not null default '{}'::jsonb,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  scheduled_at timestamptz,
  applied_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, subscription_id, id),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  check (from_add_ons <@ array['iyzico_online_payments']::text[] and cardinality(from_add_ons) <= 1),
  check (to_add_ons <@ array['iyzico_online_payments']::text[] and cardinality(to_add_ons) <= 1),
  check (cardinality(from_add_ons) = 0 or from_plan = 'pro'),
  check (cardinality(to_add_ons) = 0 or to_plan = 'pro'),
  check (char_length(btrim(provider_parent_subscription_ref)) between 1 and 200),
  check (provider_target_subscription_ref is null
    or char_length(btrim(provider_target_subscription_ref)) between 1 and 200),
  check (char_length(btrim(provider_target_plan_ref)) between 1 and 200),
  check (jsonb_typeof(provider_result_sanitized) = 'object'
    and pg_column_size(provider_result_sanitized) <= 8192)
);

create unique index subscription_change_requests_one_live_idx
  on public.subscription_change_requests(subscription_id)
  where status in ('processing', 'scheduled', 'requires_reconciliation');
create index subscription_change_requests_due_idx
  on public.subscription_change_requests(status, effective_at)
  where status = 'scheduled';

create trigger subscription_change_requests_updated_at
  before update on public.subscription_change_requests
  for each row execute function public.update_updated_at();

alter table public.subscription_change_requests enable row level security;
alter table public.subscription_change_requests force row level security;
revoke all on table public.subscription_change_requests from public, anon, authenticated;
grant select, insert, update on table public.subscription_change_requests to service_role;

create table public.billing_subscription_provider_refs (
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  provider_subscription_ref text not null,
  restaurant_id uuid not null,
  subscription_id uuid not null,
  provider_plan_ref text,
  ref_role text not null check (ref_role in ('current', 'scheduled', 'previous')),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, provider_subscription_ref),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  check (char_length(btrim(provider_subscription_ref)) between 1 and 200),
  check (provider_plan_ref is null or char_length(btrim(provider_plan_ref)) between 1 and 200),
  check ((ref_role = 'previous') = (retired_at is not null))
);

create index billing_subscription_provider_refs_subscription_idx
  on public.billing_subscription_provider_refs(subscription_id, ref_role);
create unique index billing_subscription_provider_refs_one_scheduled_idx
  on public.billing_subscription_provider_refs(subscription_id)
  where ref_role = 'scheduled';

alter table public.billing_subscription_provider_refs enable row level security;
alter table public.billing_subscription_provider_refs force row level security;
revoke all on table public.billing_subscription_provider_refs from public, anon, authenticated;
grant select, insert, update on table public.billing_subscription_provider_refs to service_role;

insert into public.billing_subscription_provider_refs (
  provider, provider_subscription_ref, restaurant_id, subscription_id,
  provider_plan_ref, ref_role
)
select provider, provider_subscription_ref, restaurant_id, id, provider_plan_ref, 'current'
from public.billing_subscriptions
where provider = 'iyzico' and provider_subscription_ref is not null
on conflict (provider, provider_subscription_ref) do nothing;

create function public.sync_billing_subscription_current_provider_ref()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
    and old.provider_subscription_ref is not null
    and old.provider_subscription_ref is distinct from new.provider_subscription_ref then
    update public.billing_subscription_provider_refs
    set ref_role = 'previous', retired_at = coalesce(retired_at, clock_timestamp()),
        updated_at = clock_timestamp()
    where provider = 'iyzico'
      and provider_subscription_ref = old.provider_subscription_ref
      and subscription_id = new.id;
  end if;
  if new.provider = 'iyzico' and new.provider_subscription_ref is not null then
    insert into public.billing_subscription_provider_refs (
      provider, provider_subscription_ref, restaurant_id, subscription_id,
      provider_plan_ref, ref_role, retired_at
    ) values (
      'iyzico', new.provider_subscription_ref, new.restaurant_id, new.id,
      new.provider_plan_ref, 'current', null
    )
    on conflict (provider, provider_subscription_ref) do update
    set provider_plan_ref = excluded.provider_plan_ref,
        ref_role = 'current', retired_at = null, updated_at = clock_timestamp()
    where public.billing_subscription_provider_refs.subscription_id = excluded.subscription_id;
    if not found then
      raise exception 'billing_provider_subscription_ref_conflict' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger sync_billing_subscription_current_provider_ref
  after insert or update of provider_subscription_ref, provider_plan_ref
  on public.billing_subscriptions
  for each row execute function public.sync_billing_subscription_current_provider_ref();

alter table public.billing_provider_operations
  drop constraint if exists billing_provider_operations_operation_type_check,
  drop constraint if exists billing_provider_operations_interval_check;
alter table public.billing_provider_operations
  add column change_request_id uuid unique references public.subscription_change_requests(id) on delete restrict,
  add column provider_target_subscription_ref text,
  add column provider_target_plan_ref text;
alter table public.billing_provider_operations
  add constraint billing_provider_operations_operation_type_check
    check (operation_type in (
      'checkout.initialize', 'payment.retry', 'subscription.cancel',
      'subscription.change', 'card_update.initialize'
    )),
  add constraint billing_provider_operations_interval_check check (
    (operation_type in ('checkout.initialize', 'subscription.change')
      and billing_interval in ('monthly', 'annual'))
    or (operation_type not in ('checkout.initialize', 'subscription.change')
      and billing_interval is null)
  ),
  add constraint billing_provider_operations_change_request_check check (
    (operation_type = 'subscription.change' and change_request_id is not null)
    or (operation_type <> 'subscription.change' and change_request_id is null)
  ),
  add constraint billing_provider_operations_target_subscription_ref_check check (
    provider_target_subscription_ref is null
    or char_length(btrim(provider_target_subscription_ref)) between 1 and 200
  ),
  add constraint billing_provider_operations_target_plan_ref_check check (
    provider_target_plan_ref is null
    or char_length(btrim(provider_target_plan_ref)) between 1 and 200
  );

alter table public.subscription_change_requests
  add constraint subscription_change_requests_provider_operation_fk
  foreign key (provider_operation_id) references public.billing_provider_operations(id) on delete restrict;

create or replace function public.prepare_subscription_plan_change(
  p_restaurant_id uuid,
  p_to_plan text,
  p_to_add_ons text[],
  p_to_billing_interval text,
  p_provider_target_plan_ref text,
  p_effective_policy text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_requested_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
  v_customer public.billing_customers%rowtype;
  v_existing public.subscription_change_requests%rowtype;
  v_change public.subscription_change_requests%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_from_add_ons text[];
  v_kind text;
begin
  if p_to_plan not in ('starter', 'plus', 'pro')
    or p_to_billing_interval not in ('monthly', 'annual')
    or p_effective_policy <> 'next_period'
    or p_requested_by is null
    or char_length(btrim(coalesce(p_provider_target_plan_ref, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_idempotency_key, ''))) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or p_to_add_ons is null
    or not (p_to_add_ons <@ array['iyzico_online_payments']::text[])
    or cardinality(p_to_add_ons) > 1
    or (cardinality(p_to_add_ons) > 0 and p_to_plan <> 'pro') then
    raise exception 'billing_plan_change_input_invalid' using errcode = '22023';
  end if;

  select * into v_existing
  from public.subscription_change_requests
  where idempotency_key = btrim(p_idempotency_key)
  for update;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.to_plan <> p_to_plan
      or v_existing.to_add_ons <> p_to_add_ons
      or v_existing.to_billing_interval <> p_to_billing_interval
      or v_existing.provider_target_plan_ref <> btrim(p_provider_target_plan_ref)
      or v_existing.request_fingerprint <> p_request_fingerprint
      or v_existing.requested_by <> p_requested_by then
      raise exception 'billing_plan_change_idempotency_conflict' using errcode = 'P0001';
    end if;
    select * into v_operation from public.billing_provider_operations
    where id = v_existing.provider_operation_id;
    return jsonb_build_object(
      'changeRequestId', v_existing.id,
      'operationId', v_existing.provider_operation_id,
      'subscriptionId', v_existing.subscription_id,
      'providerSubscriptionRef', v_existing.provider_parent_subscription_ref,
      'providerTargetPlanRef', v_existing.provider_target_plan_ref,
      'fromPlan', v_existing.from_plan,
      'toPlan', v_existing.to_plan,
      'billingInterval', v_existing.to_billing_interval,
      'effectivePolicy', v_existing.effective_policy,
      'effectiveAt', v_existing.effective_at,
      'status', v_existing.status,
      'dispatchable', false,
      'duplicate', true
    );
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled'
  for update;
  if not found or v_subscription.provider <> 'iyzico'
    or v_subscription.status <> 'active'
    or v_subscription.provider_subscription_ref is null
    or v_subscription.provider_plan_ref is null
    or v_subscription.current_period_end is null then
    raise exception 'billing_plan_change_subscription_not_eligible' using errcode = '55000';
  end if;
  if v_subscription.billing_interval <> p_to_billing_interval then
    raise exception 'billing_plan_change_interval_requires_checkout' using errcode = '0A000';
  end if;

  select coalesce(array_agg(add_on.add_on order by add_on.add_on), '{}'::text[])
  into v_from_add_ons
  from public.restaurant_subscription_add_ons add_on
  where add_on.restaurant_id = p_restaurant_id
    and add_on.subscription_id = v_subscription.id
    and add_on.status = 'active';
  if v_from_add_ons <> p_to_add_ons then
    raise exception 'billing_plan_change_add_ons_require_change_flow' using errcode = '0A000';
  end if;
  if v_subscription.plan = p_to_plan then
    raise exception 'billing_plan_change_noop' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.subscription_change_requests request
    where request.subscription_id = v_subscription.id
      and request.status in ('processing', 'scheduled', 'requires_reconciliation')
  ) then
    raise exception 'billing_plan_change_already_pending' using errcode = '55000';
  end if;

  select * into v_customer from public.billing_customers
  where id = v_subscription.billing_customer_id and restaurant_id = p_restaurant_id;
  if not found then
    raise exception 'billing_customer_not_found' using errcode = 'P0002';
  end if;
  v_kind := case
    when case p_to_plan when 'starter' then 0 when 'plus' then 1 else 2 end
      > case v_subscription.plan when 'starter' then 0 when 'plus' then 1 else 2 end
      then 'upgrade'
    else 'downgrade'
  end;

  insert into public.subscription_change_requests (
    restaurant_id, subscription_id, change_kind,
    from_plan, to_plan, from_billing_interval, to_billing_interval,
    from_add_ons, to_add_ons, effective_policy, effective_at, status,
    provider_parent_subscription_ref, provider_target_plan_ref,
    idempotency_key, request_fingerprint, requested_by
  ) values (
    p_restaurant_id, v_subscription.id, v_kind,
    v_subscription.plan, p_to_plan, v_subscription.billing_interval, p_to_billing_interval,
    v_from_add_ons, p_to_add_ons, 'next_period', v_subscription.current_period_end, 'processing',
    v_subscription.provider_subscription_ref, btrim(p_provider_target_plan_ref),
    btrim(p_idempotency_key), p_request_fingerprint, p_requested_by
  ) returning * into v_change;

  insert into public.billing_provider_operations (
    restaurant_id, billing_customer_id, subscription_id, change_request_id,
    operation_type, idempotency_key, request_fingerprint, status,
    requested_plan, requested_add_ons, billing_interval,
    provider_subscription_ref, provider_target_plan_ref
  ) values (
    p_restaurant_id, v_customer.id, v_subscription.id, v_change.id,
    'subscription.change', btrim(p_idempotency_key), p_request_fingerprint, 'processing',
    p_to_plan, p_to_add_ons, p_to_billing_interval,
    v_subscription.provider_subscription_ref, btrim(p_provider_target_plan_ref)
  ) returning * into v_operation;

  update public.subscription_change_requests
  set provider_operation_id = v_operation.id
  where id = v_change.id;

  return jsonb_build_object(
    'changeRequestId', v_change.id,
    'operationId', v_operation.id,
    'subscriptionId', v_subscription.id,
    'providerSubscriptionRef', v_subscription.provider_subscription_ref,
    'providerTargetPlanRef', btrim(p_provider_target_plan_ref),
    'fromPlan', v_subscription.plan,
    'toPlan', p_to_plan,
    'billingInterval', p_to_billing_interval,
    'effectivePolicy', 'next_period',
    'effectiveAt', v_subscription.current_period_end,
    'status', 'processing',
    'dispatchable', true,
    'duplicate', false
  );
end;
$$;

create or replace function public.finalize_subscription_plan_change(
  p_operation_id uuid,
  p_change_request_id uuid,
  p_provider_parent_subscription_ref text,
  p_provider_target_subscription_ref text,
  p_provider_target_plan_ref text,
  p_provider_status text,
  p_provider_period_start timestamptz,
  p_provider_period_end timestamptz,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_change public.subscription_change_requests%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
begin
  if p_operation_id is null or p_change_request_id is null
    or p_provider_status <> 'active'
    or char_length(btrim(coalesce(p_provider_parent_subscription_ref, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_provider_target_subscription_ref, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_provider_target_plan_ref, ''))) not between 1 and 200
    or p_provider_target_subscription_ref = p_provider_parent_subscription_ref
    or p_provider_period_start is null or p_provider_period_end <= p_provider_period_start
    or p_occurred_at is null then
    raise exception 'billing_plan_change_finalize_input_invalid' using errcode = '22023';
  end if;

  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.change' for update;
  select * into v_change from public.subscription_change_requests
  where id = p_change_request_id for update;
  if not found or v_operation.id is null
    or v_operation.change_request_id <> v_change.id
    or v_change.provider_operation_id <> v_operation.id then
    raise exception 'billing_plan_change_operation_not_found' using errcode = 'P0002';
  end if;
  if v_operation.status = 'succeeded' and v_change.status = 'scheduled' then
    if v_change.provider_parent_subscription_ref <> btrim(p_provider_parent_subscription_ref)
      or v_change.provider_target_subscription_ref <> btrim(p_provider_target_subscription_ref)
      or v_change.provider_target_plan_ref <> btrim(p_provider_target_plan_ref) then
      raise exception 'billing_plan_change_replay_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'changeRequestId', v_change.id, 'subscriptionId', v_change.subscription_id,
      'status', v_change.status, 'effectiveAt', v_change.effective_at, 'duplicate', true
    );
  end if;
  if v_operation.status not in ('processing', 'requires_reconciliation')
    or v_change.status not in ('processing', 'requires_reconciliation')
    or v_operation.provider_subscription_ref <> btrim(p_provider_parent_subscription_ref)
    or v_operation.provider_target_plan_ref <> btrim(p_provider_target_plan_ref)
    or v_change.provider_parent_subscription_ref <> btrim(p_provider_parent_subscription_ref)
    or v_change.provider_target_plan_ref <> btrim(p_provider_target_plan_ref) then
    raise exception 'billing_plan_change_provider_mismatch' using errcode = 'P0001';
  end if;

  select * into v_subscription from public.billing_subscriptions
  where id = v_change.subscription_id and restaurant_id = v_change.restaurant_id for update;
  if not found or v_subscription.provider_subscription_ref <> v_change.provider_parent_subscription_ref
    or v_subscription.provider_plan_ref is null
    or v_subscription.plan <> v_change.from_plan
    or v_subscription.billing_interval <> v_change.from_billing_interval
    or p_provider_period_start < v_change.effective_at - interval '5 minutes'
    or p_provider_period_start > v_change.effective_at + interval '1 day' then
    raise exception 'billing_plan_change_subscription_drift' using errcode = 'P0001';
  end if;

  update public.billing_provider_operations
  set status = 'succeeded',
      provider_target_subscription_ref = btrim(p_provider_target_subscription_ref),
      result_sanitized = jsonb_build_object(
        'providerParentSubscriptionRef', btrim(p_provider_parent_subscription_ref),
        'providerTargetSubscriptionRef', btrim(p_provider_target_subscription_ref),
        'providerTargetPlanRef', btrim(p_provider_target_plan_ref),
        'providerStatus', p_provider_status,
        'providerPeriodStart', p_provider_period_start,
        'providerPeriodEnd', p_provider_period_end,
        'effectivePolicy', 'next_period'
      ),
      completed_at = p_occurred_at, last_error = null
  where id = v_operation.id;

  update public.subscription_change_requests
  set status = 'scheduled',
      provider_target_subscription_ref = btrim(p_provider_target_subscription_ref),
      provider_result_sanitized = jsonb_build_object(
        'providerStatus', p_provider_status,
        'providerPeriodStart', p_provider_period_start,
        'providerPeriodEnd', p_provider_period_end
      ),
      scheduled_at = p_occurred_at, last_error = null
  where id = v_change.id;

  update public.billing_subscriptions
  set scheduled_plan = v_change.to_plan, version = version + 1
  where id = v_subscription.id;

  insert into public.billing_subscription_provider_refs (
    provider, provider_subscription_ref, restaurant_id, subscription_id,
    provider_plan_ref, ref_role, retired_at
  ) values (
    'iyzico', btrim(p_provider_target_subscription_ref), v_change.restaurant_id,
    v_change.subscription_id, btrim(p_provider_target_plan_ref), 'scheduled', null
  );

  perform public.enqueue_domain_outbox_event(
    v_change.restaurant_id, 'billing_subscription', v_change.id,
    'plan.change_scheduled',
    jsonb_build_object(
      'subscriptionId', v_change.subscription_id,
      'fromPlan', v_change.from_plan,
      'toPlan', v_change.to_plan,
      'billingInterval', v_change.to_billing_interval,
      'effectiveAt', v_change.effective_at,
      'semanticVersion', 1
    ),
    'billing:plan-change-scheduled:v1:' || v_change.id
  );

  return jsonb_build_object(
    'changeRequestId', v_change.id, 'subscriptionId', v_change.subscription_id,
    'status', 'scheduled', 'effectiveAt', v_change.effective_at, 'duplicate', false
  );
end;
$$;

create function public.sync_subscription_change_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.operation_type = 'subscription.change'
    and new.change_request_id is not null
    and new.status = 'requires_reconciliation'
    and old.status is distinct from new.status then
    update public.subscription_change_requests
    set status = 'requires_reconciliation', last_error = new.last_error
    where id = new.change_request_id
      and status in ('processing', 'requires_reconciliation');
  end if;
  return new;
end;
$$;

create trigger sync_subscription_change_reconciliation
  after update of status on public.billing_provider_operations
  for each row execute function public.sync_subscription_change_reconciliation();

create function public.assert_succeeded_plan_change_is_scheduled()
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
        and request.status in ('scheduled', 'applied')
    ) then
    raise exception 'billing_plan_change_schedule_invariant_broken' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create constraint trigger assert_succeeded_plan_change_is_scheduled
  after insert or update on public.billing_provider_operations
  deferrable initially deferred
  for each row execute function public.assert_succeeded_plan_change_is_scheduled();

revoke all on function public.prepare_subscription_plan_change(
  uuid,text,text[],text,text,text,text,text,uuid
) from public, anon, authenticated;
revoke all on function public.finalize_subscription_plan_change(
  uuid,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz
) from public, anon, authenticated;
grant execute on function public.prepare_subscription_plan_change(
  uuid,text,text[],text,text,text,text,text,uuid
) to service_role;
grant execute on function public.finalize_subscription_plan_change(
  uuid,uuid,text,text,text,text,timestamptz,timestamptz,timestamptz
) to service_role;

comment on table public.subscription_change_requests is
  'Durable owner-requested subscription plan/add-on/interval intent. Provider acceptance schedules a change; paid renewal evidence applies it.';
comment on table public.billing_subscription_provider_refs is
  'Provider subscription lineage used to map renewal webhooks across iyzico upgrade child references without replacing current entitlements early.';
