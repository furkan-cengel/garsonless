-- Phase 4a: canonical add-on catalogue and paid-renewal lifecycle.
-- Provider combined plans remain exact plan + interval + add-on bindings.

begin;

create function public.is_valid_subscription_add_on_selection(
  p_plan text,
  p_add_ons text[]
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_add_ons is not null
    and cardinality(p_add_ons) <= 1
    and p_add_ons <@ array['iyzico_online_payments', 'storefront_video_hero']::text[]
    and cardinality(p_add_ons) = cardinality(array(select distinct unnest(p_add_ons)))
    and case p_plan
      when 'starter' then p_add_ons <@ array['storefront_video_hero']::text[]
      when 'plus' then p_add_ons <@ array['storefront_video_hero']::text[]
      when 'pro' then p_add_ons <@ array['iyzico_online_payments']::text[]
      else cardinality(p_add_ons) = 0
    end;
$$;

alter table public.billing_provider_operations
  drop constraint if exists billing_provider_operations_requested_add_ons_check;
alter table public.billing_provider_operations
  add constraint billing_provider_operations_requested_add_ons_check
  check (public.is_valid_subscription_add_on_selection(requested_plan, requested_add_ons));

alter table public.subscription_invoices
  drop constraint if exists subscription_invoices_add_ons_check;
alter table public.subscription_invoices
  add constraint subscription_invoices_add_ons_check
  check (public.is_valid_subscription_add_on_selection(plan, add_ons));

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname from pg_constraint
    where conrelid = 'public.subscription_change_requests'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%from_add_ons%'
        or pg_get_constraintdef(oid) ilike '%to_add_ons%'
      )
  loop
    execute format('alter table public.subscription_change_requests drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;
alter table public.subscription_change_requests
  add constraint subscription_change_requests_from_add_ons_check
    check (public.is_valid_subscription_add_on_selection(from_plan, from_add_ons)),
  add constraint subscription_change_requests_to_add_ons_check
    check (public.is_valid_subscription_add_on_selection(to_plan, to_add_ons));

alter table public.subscription_add_on_catalog
  drop constraint if exists subscription_add_on_catalog_add_on_check,
  drop constraint if exists subscription_add_on_catalog_pkey;
alter table public.subscription_add_on_catalog add column plan text;
update public.subscription_add_on_catalog set plan = 'pro' where plan is null;
alter table public.subscription_add_on_catalog alter column plan set not null;
alter table public.subscription_add_on_catalog
  add constraint subscription_add_on_catalog_plan_check
    check (plan in ('starter', 'plus', 'pro')),
  add constraint subscription_add_on_catalog_add_on_check
    check (add_on in ('iyzico_online_payments', 'storefront_video_hero')),
  add constraint subscription_add_on_catalog_compatibility_check
    check (public.is_valid_subscription_add_on_selection(plan, array[add_on]::text[])),
  add primary key (add_on, plan, billing_interval);

alter table public.restaurant_subscription_add_ons
  drop constraint if exists restaurant_subscription_add_ons_add_on_check;
alter table public.restaurant_subscription_add_ons
  add constraint restaurant_subscription_add_ons_add_on_check
    check (add_on in ('iyzico_online_payments', 'storefront_video_hero'));

create or replace function public.prepare_subscription_checkout_with_add_ons_operation(
  p_restaurant_id uuid,
  p_legal_name text,
  p_contact_name text,
  p_contact_surname text,
  p_identity_number text,
  p_contact_email text,
  p_gsm_number text,
  p_billing_address jsonb,
  p_shipping_address jsonb,
  p_plan text,
  p_billing_interval text,
  p_amount_minor bigint,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_due_at timestamptz,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_add_ons text[],
  p_expected_provider_plan_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
  v_customer public.billing_customers%rowtype;
  v_existing public.billing_provider_operations%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_catalog public.subscription_add_on_catalog%rowtype;
begin
  if not public.is_valid_subscription_add_on_selection(p_plan, p_add_ons)
    or cardinality(p_add_ons) <> 1
    or p_billing_interval not in ('monthly', 'annual')
    or p_period_end <= p_period_start
    or char_length(btrim(p_idempotency_key)) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or char_length(btrim(coalesce(p_expected_provider_plan_ref, ''))) not between 1 and 200 then
    raise exception 'billing_add_on_checkout_input_invalid' using errcode = '22023';
  end if;

  select * into v_catalog
  from public.subscription_add_on_catalog
  where add_on = p_add_ons[1]
    and plan = p_plan
    and billing_interval = p_billing_interval
    and active = true;
  if not found
    or v_catalog.provider_gross_amount_minor <> p_amount_minor
    or v_catalog.provider_plan_ref <> btrim(p_expected_provider_plan_ref) then
    raise exception 'billing_add_on_catalog_unavailable' using errcode = 'P0002';
  end if;

  v_profile := public.upsert_subscription_billing_profile(
    p_restaurant_id, p_legal_name, p_contact_name, p_contact_surname,
    p_identity_number, p_contact_email, p_gsm_number,
    p_billing_address, p_shipping_address
  );
  select * into v_customer from public.billing_customers
  where id = (v_profile->>'customerId')::uuid for update;

  select * into v_existing from public.billing_provider_operations
  where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.operation_type <> 'checkout.initialize'
      or v_existing.request_fingerprint <> p_request_fingerprint
      or v_existing.requested_plan <> p_plan
      or v_existing.requested_add_ons is distinct from p_add_ons
      or v_existing.expected_provider_plan_ref is distinct from btrim(p_expected_provider_plan_ref) then
      raise exception 'billing_operation_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'operationId', v_existing.id, 'customerId', v_existing.billing_customer_id,
      'invoiceId', v_existing.id, 'plan', v_existing.requested_plan,
      'addOns', v_existing.requested_add_ons,
      'interval', v_existing.billing_interval,
      'amountMinor', v_existing.amount_minor, 'currency', v_existing.currency,
      'status', v_existing.status, 'dispatchable', false, 'duplicate', true,
      'providerCheckoutRef', v_existing.provider_checkout_ref,
      'profile', jsonb_build_object(
        'legalName', v_customer.legal_name, 'name', v_customer.contact_name,
        'surname', v_customer.contact_surname, 'identityNumber', v_customer.identity_number,
        'email', v_customer.contact_email, 'gsmNumber', v_customer.gsm_number,
        'billingAddress', v_customer.billing_address, 'shippingAddress', v_customer.shipping_address
      )
    );
  end if;

  insert into public.billing_provider_operations (
    restaurant_id, billing_customer_id, operation_type, idempotency_key,
    request_fingerprint, status, requested_plan, requested_add_ons,
    billing_interval, amount_minor, currency, period_start, period_end, due_at,
    expected_provider_plan_ref
  ) values (
    p_restaurant_id, v_customer.id, 'checkout.initialize', p_idempotency_key,
    p_request_fingerprint, 'processing', p_plan, p_add_ons,
    p_billing_interval, p_amount_minor, 'TRY', p_period_start, p_period_end, p_due_at,
    btrim(p_expected_provider_plan_ref)
  ) returning * into v_operation;

  return jsonb_build_object(
    'operationId', v_operation.id, 'customerId', v_customer.id,
    'invoiceId', v_operation.id, 'plan', p_plan, 'addOns', p_add_ons,
    'interval', p_billing_interval, 'amountMinor', p_amount_minor,
    'currency', 'TRY', 'status', v_operation.status,
    'dispatchable', true, 'duplicate', false, 'providerCheckoutRef', null,
    'profile', jsonb_build_object(
      'legalName', v_customer.legal_name, 'name', v_customer.contact_name,
      'surname', v_customer.contact_surname, 'identityNumber', v_customer.identity_number,
      'email', v_customer.contact_email, 'gsmNumber', v_customer.gsm_number,
      'billingAddress', v_customer.billing_address, 'shippingAddress', v_customer.shipping_address
    )
  );
end;
$$;

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
    or not public.is_valid_subscription_add_on_selection(p_to_plan, p_to_add_ons) then
    raise exception 'billing_plan_change_input_invalid' using errcode = '22023';
  end if;

  select * into v_existing from public.subscription_change_requests
  where idempotency_key = btrim(p_idempotency_key) for update;
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
    return jsonb_build_object(
      'changeRequestId', v_existing.id,
      'operationId', v_existing.provider_operation_id,
      'subscriptionId', v_existing.subscription_id,
      'providerSubscriptionRef', v_existing.provider_parent_subscription_ref,
      'providerTargetPlanRef', v_existing.provider_target_plan_ref,
      'fromPlan', v_existing.from_plan, 'toPlan', v_existing.to_plan,
      'billingInterval', v_existing.to_billing_interval,
      'effectivePolicy', v_existing.effective_policy,
      'effectiveAt', v_existing.effective_at, 'status', v_existing.status,
      'dispatchable', false, 'duplicate', true
    );
  end if;

  select * into v_subscription from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled' for update;
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
  into v_from_add_ons from public.restaurant_subscription_add_ons add_on
  where add_on.restaurant_id = p_restaurant_id
    and add_on.subscription_id = v_subscription.id
    and add_on.status = 'active'
    and add_on.current_period_end > clock_timestamp();
  if v_subscription.plan = p_to_plan and v_from_add_ons = p_to_add_ons then
    raise exception 'billing_plan_change_noop' using errcode = '22023';
  end if;
  if cardinality(p_to_add_ons) = 1 and not exists (
    select 1 from public.subscription_add_on_catalog catalog
    where catalog.add_on = p_to_add_ons[1]
      and catalog.plan = p_to_plan
      and catalog.billing_interval = p_to_billing_interval
      and catalog.provider_plan_ref = btrim(p_provider_target_plan_ref)
      and catalog.active = true
  ) then
    raise exception 'billing_add_on_catalog_unavailable' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.subscription_change_requests request
    where request.subscription_id = v_subscription.id
      and request.status in ('processing', 'scheduled', 'paid_pending', 'paid_draining', 'requires_reconciliation')
  ) then
    raise exception 'billing_plan_change_already_pending' using errcode = '55000';
  end if;

  select * into v_customer from public.billing_customers
  where id = v_subscription.billing_customer_id and restaurant_id = p_restaurant_id;
  if not found then raise exception 'billing_customer_not_found' using errcode = 'P0002'; end if;
  v_kind := case
    when v_subscription.plan = p_to_plan and cardinality(v_from_add_ons) < cardinality(p_to_add_ons)
      then 'add_on_add'
    when v_subscription.plan = p_to_plan then 'add_on_remove'
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
  update public.subscription_change_requests set provider_operation_id = v_operation.id
  where id = v_change.id;

  return jsonb_build_object(
    'changeRequestId', v_change.id, 'operationId', v_operation.id,
    'subscriptionId', v_subscription.id,
    'providerSubscriptionRef', v_subscription.provider_subscription_ref,
    'providerTargetPlanRef', btrim(p_provider_target_plan_ref),
    'fromPlan', v_subscription.plan, 'toPlan', p_to_plan,
    'billingInterval', p_to_billing_interval, 'effectivePolicy', 'next_period',
    'effectiveAt', v_subscription.current_period_end, 'status', 'processing',
    'dispatchable', true, 'duplicate', false
  );
end;
$$;

create or replace function public.activate_paid_subscription_invoice_add_ons()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
  v_add_on text;
begin
  if new.status <> 'paid' or old.status = 'paid' or cardinality(new.add_ons) = 0 then
    return new;
  end if;
  if not public.is_valid_subscription_add_on_selection(new.plan, new.add_ons) then
    raise exception 'billing_add_on_paid_invoice_context_invalid' using errcode = 'P0001';
  end if;
  select * into v_subscription from public.billing_subscriptions
  where id = new.subscription_id and restaurant_id = new.restaurant_id
    and status in ('active', 'past_due', 'grace_period') for update;
  if not found or v_subscription.plan <> new.plan then
    -- A scheduled change is synchronized by the applied change trigger below.
    return new;
  end if;
  foreach v_add_on in array new.add_ons loop
    insert into public.restaurant_subscription_add_ons (
      restaurant_id, add_on, subscription_id, status,
      current_period_start, current_period_end, activated_at, cancelled_at
    ) values (
      new.restaurant_id, v_add_on, new.subscription_id, 'active',
      new.period_start, new.period_end, new.paid_at, null
    ) on conflict (restaurant_id, add_on) do update set
      subscription_id = excluded.subscription_id, status = 'active',
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      activated_at = excluded.activated_at, cancelled_at = null,
      updated_at = clock_timestamp();
  end loop;
  return new;
end;
$$;

create function public.sync_applied_subscription_change_add_ons()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
  v_add_on text;
begin
  if new.status <> 'applied' or old.status = 'applied' then return new; end if;
  select * into v_subscription from public.billing_subscriptions
  where id = new.subscription_id and restaurant_id = new.restaurant_id for update;
  if not found or v_subscription.plan <> new.to_plan
    or not public.is_valid_subscription_add_on_selection(new.to_plan, new.to_add_ons) then
    raise exception 'billing_add_on_change_application_invalid' using errcode = 'P0001';
  end if;
  update public.restaurant_subscription_add_ons
  set status = 'cancelled', cancelled_at = coalesce(new.applied_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where restaurant_id = new.restaurant_id
    and subscription_id = new.subscription_id
    and status = 'active'
    and not (add_on = any(new.to_add_ons));
  foreach v_add_on in array new.to_add_ons loop
    insert into public.restaurant_subscription_add_ons (
      restaurant_id, add_on, subscription_id, status,
      current_period_start, current_period_end, activated_at, cancelled_at
    ) values (
      new.restaurant_id, v_add_on, new.subscription_id, 'active',
      v_subscription.current_period_start, v_subscription.current_period_end,
      coalesce(new.applied_at, clock_timestamp()), null
    ) on conflict (restaurant_id, add_on) do update set
      subscription_id = excluded.subscription_id, status = 'active',
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      activated_at = excluded.activated_at, cancelled_at = null,
      updated_at = clock_timestamp();
  end loop;
  return new;
end;
$$;

create trigger sync_applied_subscription_change_add_ons
  after update of status on public.subscription_change_requests
  for each row execute function public.sync_applied_subscription_change_add_ons();

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
  v_active_add_ons text[] := '{}'::text[];
  v_current_binding boolean := false;
  v_change_binding boolean := false;
begin
  if char_length(btrim(coalesce(p_worker, ''))) not between 1 and 160
    or coalesce(char_length(btrim(p_provider_customer_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_subscription_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_invoice_ref)), 0) not between 1 and 200
    or coalesce(char_length(btrim(p_provider_plan_ref)), 0) not between 1 and 200
    or p_plan not in ('starter', 'plus', 'pro')
    or not public.is_valid_subscription_add_on_selection(p_plan, p_add_ons)
    or p_billing_interval not in ('monthly', 'annual')
    or p_currency <> 'TRY' or p_amount_minor <= 0
    or p_period_end <= p_period_start
    or p_provider_order_status not in ('succeeded', 'failed') then
    raise exception 'billing_invoice_hydration_input_invalid' using errcode = '22023';
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
  select coalesce(array_agg(add_on order by add_on), '{}'::text[])
  into v_active_add_ons from public.restaurant_subscription_add_ons
  where restaurant_id = v_subscription.restaurant_id
    and subscription_id = v_subscription.id
    and status = 'active' and current_period_end > clock_timestamp();
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
    and v_subscription.billing_interval = p_billing_interval
    and v_active_add_ons = p_add_ons;
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
    where add_on = p_add_ons[1] and plan = p_plan
      and billing_interval = p_billing_interval
      and provider_plan_ref = btrim(p_provider_plan_ref)
      and active = true;
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
      or v_invoice.plan <> p_plan or v_invoice.add_ons <> p_add_ons
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
    set current_period_start = p_period_start, current_period_end = p_period_end,
        version = version + 1 where id = v_subscription.id;
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
    'invoiceId', v_invoice.id, 'invoiceStatus', v_transition->>'invoiceStatus',
    'subscriptionStatus', v_transition->>'subscriptionStatus',
    'eventType', v_event.event_type,
    'duplicate', coalesce((v_transition->>'duplicate')::boolean, false)
  );
end;
$$;

alter function public.read_subscription_billing_settings(uuid)
  rename to read_subscription_billing_settings_before_add_on_lifecycle;
revoke all on function public.read_subscription_billing_settings_before_add_on_lifecycle(uuid)
  from public, anon, authenticated, service_role;

create function public.read_subscription_billing_settings(p_restaurant_id uuid)
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
    v_settings := jsonb_set(v_settings, '{subscription,activeAddOns}', to_jsonb(v_active_add_ons), true);
    v_settings := jsonb_set(v_settings, '{subscription,scheduledAddOns}', to_jsonb(v_scheduled_add_ons), true);
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

revoke all on function public.is_valid_subscription_add_on_selection(text,text[])
  from public, anon, authenticated;
revoke all on function public.sync_applied_subscription_change_add_ons()
  from public, anon, authenticated;
revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;

comment on function public.is_valid_subscription_add_on_selection(text,text[]) is
  'Canonical DB mirror of the closed plan/add-on compatibility catalogue.';
comment on function public.sync_applied_subscription_change_add_ons() is
  'Activates and deactivates add-on entitlements only after a paid scheduled change is applied.';

commit;
