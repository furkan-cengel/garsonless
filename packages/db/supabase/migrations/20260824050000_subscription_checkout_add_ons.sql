-- Pro-only subscription add-ons. Existing plan-only checkout keeps using the
-- previous RPC unchanged; this additive path is selected only when an add-on
-- is explicitly selected and its price/provider contract is fully configured.

alter table public.billing_provider_operations
  add column requested_add_ons text[] not null default '{}'::text[];
alter table public.billing_provider_operations
  add constraint billing_provider_operations_requested_add_ons_check
  check (
    requested_add_ons <@ array['iyzico_online_payments']::text[]
    and cardinality(requested_add_ons) <= 1
    and (cardinality(requested_add_ons) = 0 or requested_plan = 'pro')
  );

alter table public.subscription_invoices
  add column add_ons text[] not null default '{}'::text[];
alter table public.subscription_invoices
  add constraint subscription_invoices_add_ons_check
  check (
    add_ons <@ array['iyzico_online_payments']::text[]
    and cardinality(add_ons) <= 1
    and (cardinality(add_ons) = 0 or plan = 'pro')
  );

create table public.subscription_add_on_catalog (
  add_on text not null check (add_on = 'iyzico_online_payments'),
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  net_amount_minor bigint not null check (net_amount_minor > 0),
  -- Full Pro + add-on amount sent to the provider, including configured KDV.
  provider_gross_amount_minor bigint not null check (provider_gross_amount_minor >= net_amount_minor),
  provider_plan_ref text not null check (char_length(btrim(provider_plan_ref)) between 1 and 200),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (add_on, billing_interval),
  unique (provider_plan_ref)
);

create table public.restaurant_subscription_add_ons (
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  add_on text not null check (add_on = 'iyzico_online_payments'),
  subscription_id uuid not null references public.billing_subscriptions(id) on delete restrict,
  status text not null check (status in ('active', 'cancelled')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null check (current_period_end > current_period_start),
  activated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, add_on),
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  check ((status = 'active' and cancelled_at is null) or status = 'cancelled')
);

create index restaurant_subscription_add_ons_active_idx
  on public.restaurant_subscription_add_ons(restaurant_id, add_on)
  where status = 'active';

alter table public.subscription_add_on_catalog enable row level security;
alter table public.subscription_add_on_catalog force row level security;
alter table public.restaurant_subscription_add_ons enable row level security;
alter table public.restaurant_subscription_add_ons force row level security;
revoke all on table public.subscription_add_on_catalog from public, anon, authenticated;
revoke all on table public.restaurant_subscription_add_ons from public, anon, authenticated;
grant select, insert, update on table public.subscription_add_on_catalog to service_role;
grant select, insert, update on table public.restaurant_subscription_add_ons to service_role;

create trigger subscription_add_on_catalog_updated_at
  before update on public.subscription_add_on_catalog
  for each row execute function public.update_updated_at();
create trigger restaurant_subscription_add_ons_updated_at
  before update on public.restaurant_subscription_add_ons
  for each row execute function public.update_updated_at();

create function public.prepare_subscription_checkout_with_add_ons_operation(
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
  if p_plan <> 'pro'
    or p_add_ons is distinct from array['iyzico_online_payments']::text[]
    or p_billing_interval not in ('monthly', 'annual')
    or p_period_end <= p_period_start
    or char_length(btrim(p_idempotency_key)) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or char_length(btrim(coalesce(p_expected_provider_plan_ref, ''))) not between 1 and 200 then
    raise exception 'billing_add_on_checkout_input_invalid' using errcode = '22023';
  end if;

  select * into v_catalog
  from public.subscription_add_on_catalog
  where add_on = 'iyzico_online_payments'
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
      or v_existing.requested_add_ons is distinct from p_add_ons then
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
    billing_interval, amount_minor, currency, period_start, period_end, due_at
  ) values (
    p_restaurant_id, v_customer.id, 'checkout.initialize', p_idempotency_key,
    p_request_fingerprint, 'processing', p_plan, p_add_ons,
    p_billing_interval, p_amount_minor, 'TRY', p_period_start, p_period_end, p_due_at
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

revoke all on function public.prepare_subscription_checkout_with_add_ons_operation(
  uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,
  timestamptz,timestamptz,timestamptz,text,text,text[],text
) from public, anon, authenticated;
grant execute on function public.prepare_subscription_checkout_with_add_ons_operation(
  uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,
  timestamptz,timestamptz,timestamptz,text,text,text[],text
) to service_role;

create function public.activate_subscription_checkout_add_ons()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
begin
  if new.status <> 'succeeded' or old.status = 'succeeded'
    or not (new.requested_add_ons @> array['iyzico_online_payments']::text[]) then
    return new;
  end if;
  if new.requested_plan <> 'pro' or new.subscription_id is null or new.invoice_id is null then
    raise exception 'billing_add_on_activation_context_invalid' using errcode = 'P0001';
  end if;
  select * into v_subscription from public.billing_subscriptions
  where id = new.subscription_id and restaurant_id = new.restaurant_id and status = 'active'
  for update;
  if not found then
    raise exception 'billing_add_on_subscription_not_active' using errcode = 'P0001';
  end if;
  insert into public.restaurant_subscription_add_ons (
    restaurant_id, add_on, subscription_id, status,
    current_period_start, current_period_end, activated_at, cancelled_at
  ) values (
    new.restaurant_id, 'iyzico_online_payments', v_subscription.id, 'active',
    v_subscription.current_period_start, v_subscription.current_period_end,
    clock_timestamp(), null
  ) on conflict (restaurant_id, add_on) do update set
    subscription_id = excluded.subscription_id,
    status = 'active',
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    activated_at = excluded.activated_at,
    cancelled_at = null,
    updated_at = clock_timestamp();
  update public.subscription_invoices
  set add_ons = new.requested_add_ons
  where id = new.invoice_id and restaurant_id = new.restaurant_id;
  return new;
end;
$$;

create trigger activate_subscription_checkout_add_ons
  after update of status on public.billing_provider_operations
  for each row execute function public.activate_subscription_checkout_add_ons();

create function public.cancel_subscription_add_ons()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.restaurant_subscription_add_ons
    set status = 'cancelled',
        cancelled_at = coalesce(new.cancelled_at, clock_timestamp()),
        updated_at = clock_timestamp()
    where restaurant_id = new.restaurant_id and subscription_id = new.id and status = 'active';
  elsif new.status in ('active', 'past_due', 'grace_period')
    and new.current_period_start is not null and new.current_period_end is not null then
    update public.restaurant_subscription_add_ons
    set current_period_start = new.current_period_start,
        current_period_end = new.current_period_end,
        updated_at = clock_timestamp()
    where restaurant_id = new.restaurant_id and subscription_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger cancel_subscription_add_ons
  after update of status, current_period_start, current_period_end on public.billing_subscriptions
  for each row execute function public.cancel_subscription_add_ons();

create or replace function public.read_restaurant_entitlement_context(
  p_restaurant_id uuid,
  p_feature text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
  v_expired public.billing_subscriptions%rowtype;
  v_override jsonb;
  v_access_allowed boolean := false;
  v_active_add_ons text[] := '{}'::text[];
begin
  update public.billing_subscriptions
  set status = 'trial_expired', version = version + 1, updated_at = clock_timestamp()
  where restaurant_id = p_restaurant_id and status = 'trial'
    and trial_ends_at <= clock_timestamp()
  returning * into v_expired;
  if found then
    insert into public.tenant_lifecycle_events (
      restaurant_id, subscription_id, from_status, to_status, actor_type,
      actor_user_id, reason_code, request_id, occurred_at
    ) values (
      p_restaurant_id, v_expired.id, 'trial', 'trial_expired', 'system', null,
      'trial_ended_without_payment', 'trial:expired:' || v_expired.id, clock_timestamp()
    ) on conflict (request_id) do nothing;
  end if;

  select * into v_subscription from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled'
  order by created_at desc limit 1;
  if found then
    v_access_allowed := v_subscription.status in ('active', 'past_due', 'grace_period')
      or (v_subscription.status = 'trial' and v_subscription.trial_ends_at > clock_timestamp());
    select coalesce(array_agg(add_on order by add_on), '{}'::text[])
    into v_active_add_ons
    from public.restaurant_subscription_add_ons
    where restaurant_id = p_restaurant_id
      and subscription_id = v_subscription.id
      and status = 'active'
      and current_period_end > clock_timestamp();
  end if;

  select public.read_active_tenant_feature_override(p_restaurant_id, p_feature) into v_override;
  return jsonb_build_object(
    'accessAllowed', v_access_allowed,
    'subscriptionStatus', case when v_subscription.id is null then null else v_subscription.status end,
    'trialEndsAt', case when v_subscription.id is null then null else v_subscription.trial_ends_at end,
    'addOnEntitlementsVersion', 1,
    'activeAddOns', to_jsonb(v_active_add_ons),
    'override', v_override
  );
end;
$$;

revoke all on function public.read_restaurant_entitlement_context(uuid,text)
  from public, anon, authenticated;
grant execute on function public.read_restaurant_entitlement_context(uuid,text)
  to service_role;

create function public.read_restaurant_subscription_add_ons(p_restaurant_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(add_on order by add_on), '{}'::text[])
  from public.restaurant_subscription_add_ons
  where restaurant_id = p_restaurant_id
    and status = 'active'
    and current_period_end > now();
$$;

revoke all on function public.read_restaurant_subscription_add_ons(uuid)
  from public, anon, authenticated;
grant execute on function public.read_restaurant_subscription_add_ons(uuid)
  to service_role;

comment on table public.subscription_add_on_catalog is
  'Service-role-only add-on price/provider binding. Rows must match server env before add-on checkout is enabled.';
comment on table public.restaurant_subscription_add_ons is
  'Tenant entitlement activated atomically only after a verified hosted subscription checkout succeeds.';
