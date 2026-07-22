-- SaaS billing provider operations (Faz 5.4b).
-- Owner authority is resolved by the dashboard adapter before these
-- service-role-only RPCs. External provider calls are claimed durably so a
-- browser replay cannot create parallel checkout/retry/cancel operations.

alter table public.billing_customers
  add column contact_name text,
  add column contact_surname text,
  add column identity_number text,
  add column gsm_number text,
  add column billing_address jsonb,
  add column shipping_address jsonb,
  add column profile_completed_at timestamptz;

alter table public.billing_customers
  add constraint billing_customers_contact_name_check
    check (contact_name is null or char_length(btrim(contact_name)) between 1 and 100),
  add constraint billing_customers_contact_surname_check
    check (contact_surname is null or char_length(btrim(contact_surname)) between 1 and 100),
  add constraint billing_customers_identity_number_check
    check (identity_number is null or identity_number ~ '^[0-9]{10,11}$'),
  add constraint billing_customers_gsm_number_check
    check (gsm_number is null or gsm_number ~ '^\\+?[0-9]{10,15}$'),
  add constraint billing_customers_billing_address_check
    check (billing_address is null or (jsonb_typeof(billing_address) = 'object' and pg_column_size(billing_address) <= 4096)),
  add constraint billing_customers_shipping_address_check
    check (shipping_address is null or (jsonb_typeof(shipping_address) = 'object' and pg_column_size(shipping_address) <= 4096));

create table public.billing_provider_operations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  billing_customer_id uuid not null,
  subscription_id uuid,
  invoice_id uuid,
  provider text not null default 'iyzico' check (provider = 'iyzico'),
  operation_type text not null check (operation_type in (
    'checkout.initialize', 'payment.retry', 'subscription.cancel'
  )),
  idempotency_key text not null unique check (char_length(btrim(idempotency_key)) between 1 and 160),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null default 'processing' check (status in (
    'processing', 'awaiting_callback', 'succeeded', 'requires_reconciliation'
  )),
  requested_plan text check (requested_plan is null or requested_plan in ('starter', 'pro', 'enterprise')),
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  currency text check (currency is null or currency = 'TRY'),
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz,
  provider_checkout_ref text,
  provider_payment_ref text,
  provider_subscription_ref text,
  result_sanitized jsonb not null default '{}'::jsonb,
  attempts integer not null default 1 check (attempts > 0),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (provider, provider_checkout_ref),
  foreign key (restaurant_id, billing_customer_id)
    references public.billing_customers(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, subscription_id)
    references public.billing_subscriptions(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, invoice_id)
    references public.subscription_invoices(restaurant_id, id) on delete restrict,
  check (jsonb_typeof(result_sanitized) = 'object'),
  check (pg_column_size(result_sanitized) <= 8192),
  check ((period_start is null and period_end is null) or period_end > period_start)
);

create index billing_provider_operations_restaurant_idx
  on public.billing_provider_operations(restaurant_id, created_at desc);
create index billing_provider_operations_reconciliation_idx
  on public.billing_provider_operations(updated_at)
  where status = 'requires_reconciliation';

create trigger billing_provider_operations_updated_at
  before update on public.billing_provider_operations
  for each row execute function public.update_updated_at();

alter table public.billing_provider_operations enable row level security;
revoke all on public.billing_provider_operations from public, anon, authenticated;
grant select, insert, update, delete on public.billing_provider_operations to service_role;

create or replace function public.upsert_subscription_billing_profile(
  p_restaurant_id uuid,
  p_legal_name text,
  p_contact_name text,
  p_contact_surname text,
  p_identity_number text,
  p_contact_email text,
  p_gsm_number text,
  p_billing_address jsonb,
  p_shipping_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.billing_customers%rowtype;
begin
  if char_length(btrim(p_legal_name)) not between 1 and 200
    or char_length(btrim(p_contact_name)) not between 1 and 100
    or char_length(btrim(p_contact_surname)) not between 1 and 100
    or p_identity_number !~ '^[0-9]{10,11}$'
    or char_length(btrim(p_contact_email)) not between 3 and 320
    or p_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_gsm_number !~ '^\\+?[0-9]{10,15}$'
    or jsonb_typeof(p_billing_address) <> 'object'
    or jsonb_typeof(p_shipping_address) <> 'object'
    or pg_column_size(p_billing_address) > 4096
    or pg_column_size(p_shipping_address) > 4096
    or coalesce(char_length(btrim(p_billing_address->>'contactName')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_billing_address->>'city')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_billing_address->>'country')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_billing_address->>'address')), 0) not between 1 and 500
    or coalesce(char_length(btrim(p_shipping_address->>'contactName')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_shipping_address->>'city')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_shipping_address->>'country')), 0) not between 1 and 100
    or coalesce(char_length(btrim(p_shipping_address->>'address')), 0) not between 1 and 500 then
    raise exception 'billing_profile_input_invalid' using errcode = '22023';
  end if;

  insert into public.billing_customers (
    restaurant_id, legal_name, contact_name, contact_surname,
    identity_number, contact_email, gsm_number, billing_address,
    shipping_address, profile_completed_at
  ) values (
    p_restaurant_id, btrim(p_legal_name), btrim(p_contact_name),
    btrim(p_contact_surname), btrim(p_identity_number),
    lower(btrim(p_contact_email)), btrim(p_gsm_number), p_billing_address,
    p_shipping_address, clock_timestamp()
  )
  on conflict (restaurant_id) do update set
    legal_name = excluded.legal_name,
    contact_name = excluded.contact_name,
    contact_surname = excluded.contact_surname,
    identity_number = excluded.identity_number,
    contact_email = excluded.contact_email,
    gsm_number = excluded.gsm_number,
    billing_address = excluded.billing_address,
    shipping_address = excluded.shipping_address,
    profile_completed_at = excluded.profile_completed_at
  returning * into v_customer;

  return jsonb_build_object('customerId', v_customer.id);
end;
$$;

create or replace function public.prepare_subscription_checkout_operation(
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
  p_amount_minor bigint,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_due_at timestamptz,
  p_idempotency_key text,
  p_request_fingerprint text
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
begin
  if p_plan not in ('starter', 'pro', 'enterprise') or p_amount_minor <= 0
    or p_period_end <= p_period_start
    or char_length(btrim(p_idempotency_key)) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'billing_checkout_input_invalid' using errcode = '22023';
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
      or v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'billing_operation_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'operationId', v_existing.id, 'customerId', v_existing.billing_customer_id,
      'invoiceId', v_existing.id, 'plan', v_existing.requested_plan,
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
    request_fingerprint, status, requested_plan, amount_minor, currency,
    period_start, period_end, due_at
  ) values (
    p_restaurant_id, v_customer.id, 'checkout.initialize', p_idempotency_key,
    p_request_fingerprint, 'processing', p_plan, p_amount_minor, 'TRY',
    p_period_start, p_period_end, p_due_at
  ) returning * into v_operation;

  return jsonb_build_object(
    'operationId', v_operation.id, 'customerId', v_customer.id,
    'invoiceId', v_operation.id, 'plan', p_plan, 'amountMinor', p_amount_minor,
    'currency', 'TRY', 'status', v_operation.status, 'dispatchable', true,
    'duplicate', false, 'providerCheckoutRef', null,
    'profile', jsonb_build_object(
      'legalName', v_customer.legal_name, 'name', v_customer.contact_name,
      'surname', v_customer.contact_surname, 'identityNumber', v_customer.identity_number,
      'email', v_customer.contact_email, 'gsmNumber', v_customer.gsm_number,
      'billingAddress', v_customer.billing_address, 'shippingAddress', v_customer.shipping_address
    )
  );
end;
$$;

create or replace function public.mark_subscription_checkout_initialized(
  p_operation_id uuid,
  p_provider_checkout_ref text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(p_provider_checkout_ref)) not between 1 and 200 then
    raise exception 'billing_checkout_reference_invalid' using errcode = '22023';
  end if;
  update public.billing_provider_operations
  set status = 'awaiting_callback', provider_checkout_ref = btrim(p_provider_checkout_ref),
      last_error = null
  where id = p_operation_id and operation_type = 'checkout.initialize'
    and status = 'processing';
  if not found then raise exception 'billing_checkout_operation_not_claimed' using errcode = 'P0002'; end if;
  return true;
end;
$$;

create or replace function public.find_subscription_checkout_callback(
  p_provider_checkout_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_operation public.billing_provider_operations%rowtype;
begin
  select * into v_operation from public.billing_provider_operations
  where provider = 'iyzico' and provider_checkout_ref = p_provider_checkout_ref;
  if not found then raise exception 'billing_checkout_operation_not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'operationId', v_operation.id, 'restaurantId', v_operation.restaurant_id,
    'invoiceId', coalesce(v_operation.invoice_id, v_operation.id)
  );
end;
$$;

create or replace function public.finalize_subscription_checkout_operation(
  p_operation_id uuid,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_plan_ref text,
  p_provider_invoice_ref text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_duplicate boolean := false;
begin
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id for update;
  if not found or v_operation.operation_type <> 'checkout.initialize' then
    raise exception 'billing_checkout_operation_not_found' using errcode = 'P0002';
  end if;
  if v_operation.status = 'succeeded' then
    return jsonb_build_object(
      'restaurantId', v_operation.restaurant_id,
      'subscriptionId', v_operation.subscription_id,
      'invoiceId', v_operation.invoice_id, 'duplicate', true
    );
  end if;
  if v_operation.status not in ('awaiting_callback', 'requires_reconciliation')
    or char_length(btrim(p_provider_customer_ref)) not between 1 and 200
    or char_length(btrim(p_provider_subscription_ref)) not between 1 and 200
    or char_length(btrim(p_provider_plan_ref)) not between 1 and 200
    or char_length(btrim(p_provider_invoice_ref)) not between 1 and 200
    or p_period_end <= p_period_start then
    raise exception 'billing_checkout_finalize_invalid' using errcode = '22023';
  end if;

  update public.billing_customers
  set provider_customer_ref = btrim(p_provider_customer_ref)
  where id = v_operation.billing_customer_id and restaurant_id = v_operation.restaurant_id;

  select * into v_subscription from public.billing_subscriptions
  where restaurant_id = v_operation.restaurant_id and status <> 'cancelled'
  for update;
  if found then
    if v_subscription.provider_subscription_ref is not null
      and v_subscription.provider_subscription_ref <> p_provider_subscription_ref then
      raise exception 'billing_live_subscription_conflict' using errcode = 'P0001';
    end if;
    update public.billing_subscriptions set
      provider_subscription_ref = btrim(p_provider_subscription_ref),
      plan = v_operation.requested_plan,
      status = 'active', current_period_start = p_period_start,
      current_period_end = p_period_end, version = version + 1
    where id = v_subscription.id returning * into v_subscription;
  else
    insert into public.billing_subscriptions (
      restaurant_id, billing_customer_id, provider_subscription_ref, plan,
      status, current_period_start, current_period_end
    ) values (
      v_operation.restaurant_id, v_operation.billing_customer_id,
      btrim(p_provider_subscription_ref), v_operation.requested_plan,
      'active', p_period_start, p_period_end
    ) returning * into v_subscription;
  end if;

  insert into public.subscription_invoices (
    restaurant_id, subscription_id, provider_invoice_ref, idempotency_key,
    plan, amount_due_minor, status, period_start, period_end, due_at, finalized_at
  ) values (
    v_operation.restaurant_id, v_subscription.id, btrim(p_provider_invoice_ref),
    v_operation.idempotency_key || ':invoice', v_operation.requested_plan,
    v_operation.amount_minor, 'open', p_period_start, p_period_end,
    v_operation.due_at, clock_timestamp()
  )
  on conflict (idempotency_key) do update set
    provider_invoice_ref = excluded.provider_invoice_ref
  returning * into v_invoice;

  update public.billing_provider_operations set
    status = 'succeeded', subscription_id = v_subscription.id,
    invoice_id = v_invoice.id, provider_subscription_ref = btrim(p_provider_subscription_ref),
    result_sanitized = jsonb_build_object(
      'providerPlanRef', btrim(p_provider_plan_ref),
      'providerInvoiceRef', btrim(p_provider_invoice_ref)
    ), completed_at = clock_timestamp(), last_error = null
  where id = v_operation.id;

  return jsonb_build_object(
    'restaurantId', v_operation.restaurant_id, 'subscriptionId', v_subscription.id,
    'invoiceId', v_invoice.id, 'duplicate', v_duplicate
  );
end;
$$;

create or replace function public.claim_subscription_billing_operation(
  p_restaurant_id uuid,
  p_operation_type text,
  p_invoice_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.billing_customers%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_existing public.billing_provider_operations%rowtype;
  v_operation public.billing_provider_operations%rowtype;
  v_provider_ref text;
begin
  if p_operation_type not in ('payment.retry', 'subscription.cancel')
    or char_length(btrim(p_idempotency_key)) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'billing_operation_input_invalid' using errcode = '22023';
  end if;

  -- Replay must be resolved before inspecting mutable aggregate state. A
  -- successful cancellation no longer has a live subscription and a
  -- successful retry may already have moved the invoice out of past_due;
  -- both still need to return the original operation without another
  -- provider call.
  select * into v_existing from public.billing_provider_operations
  where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.operation_type <> p_operation_type
      or v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'billing_operation_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'operationId', v_existing.id, 'invoiceId', v_existing.invoice_id,
      'subscriptionId', v_existing.subscription_id,
      'providerRef', coalesce(v_existing.provider_payment_ref, v_existing.provider_subscription_ref),
      'status', v_existing.status, 'dispatchable', false, 'duplicate', true
    );
  end if;

  select * into v_customer from public.billing_customers where restaurant_id = p_restaurant_id;
  if not found then raise exception 'billing_customer_not_found' using errcode = 'P0002'; end if;
  select * into v_subscription from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled' for update;
  if not found then raise exception 'billing_subscription_not_found' using errcode = 'P0002'; end if;

  if p_operation_type = 'payment.retry' then
    select * into v_invoice from public.subscription_invoices
    where id = p_invoice_id and restaurant_id = p_restaurant_id
      and subscription_id = v_subscription.id and status = 'past_due' for update;
    if not found or v_invoice.provider_invoice_ref is null then
      raise exception 'billing_retry_invoice_not_found' using errcode = 'P0002';
    end if;
    v_provider_ref := v_invoice.provider_invoice_ref;
  else
    if v_subscription.provider_subscription_ref is null then
      raise exception 'billing_provider_subscription_missing' using errcode = 'P0002';
    end if;
    v_provider_ref := v_subscription.provider_subscription_ref;
  end if;

  insert into public.billing_provider_operations (
    restaurant_id, billing_customer_id, subscription_id, invoice_id,
    operation_type, idempotency_key, request_fingerprint, status,
    provider_payment_ref, provider_subscription_ref
  ) values (
    p_restaurant_id, v_customer.id, v_subscription.id,
    case when p_operation_type = 'payment.retry' then v_invoice.id else null end,
    p_operation_type, p_idempotency_key, p_request_fingerprint, 'processing',
    case when p_operation_type = 'payment.retry' then v_provider_ref else null end,
    case when p_operation_type = 'subscription.cancel' then v_provider_ref else null end
  ) returning * into v_operation;

  return jsonb_build_object(
    'operationId', v_operation.id, 'invoiceId', v_operation.invoice_id,
    'subscriptionId', v_operation.subscription_id, 'providerRef', v_provider_ref,
    'status', v_operation.status, 'dispatchable', true, 'duplicate', false
  );
end;
$$;

create or replace function public.complete_subscription_billing_operation(
  p_operation_id uuid,
  p_result_sanitized jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_result_sanitized) <> 'object' or pg_column_size(p_result_sanitized) > 8192 then
    raise exception 'billing_operation_result_invalid' using errcode = '22023';
  end if;
  update public.billing_provider_operations set
    status = 'succeeded', result_sanitized = p_result_sanitized,
    completed_at = clock_timestamp(), last_error = null
  where id = p_operation_id and status = 'processing';
  if not found then
    if exists (select 1 from public.billing_provider_operations where id = p_operation_id and status = 'succeeded') then
      return true;
    end if;
    raise exception 'billing_operation_not_claimed' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

create or replace function public.mark_subscription_billing_operation_reconciliation(
  p_operation_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.billing_provider_operations set
    status = 'requires_reconciliation', last_error = left(p_reason, 1000)
  where id = p_operation_id and status in ('processing', 'awaiting_callback');
  if not found then raise exception 'billing_operation_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$$;

create or replace function public.finalize_subscription_cancellation(
  p_operation_id uuid,
  p_cancelled_at timestamptz,
  p_actor_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_from text;
begin
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.cancel' for update;
  if not found or v_operation.status <> 'succeeded' then
    raise exception 'billing_cancellation_not_completed' using errcode = 'P0002';
  end if;
  select * into v_subscription from public.billing_subscriptions
  where id = v_operation.subscription_id and restaurant_id = v_operation.restaurant_id for update;
  if v_subscription.status = 'cancelled' then
    return jsonb_build_object('subscriptionId', v_subscription.id, 'duplicate', true);
  end if;
  v_from := v_subscription.status;
  update public.billing_subscriptions set
    status = 'cancelled', cancelled_at = p_cancelled_at,
    cancel_at_period_end = false, version = version + 1
  where id = v_subscription.id returning * into v_subscription;
  update public.restaurants set plan = 'free' where id = v_operation.restaurant_id;
  insert into public.tenant_lifecycle_events (
    restaurant_id, subscription_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, request_id, occurred_at
  ) values (
    v_operation.restaurant_id, v_subscription.id, v_from, 'cancelled',
    'tenant_owner', p_actor_user_id, 'tenant_cancelled', p_request_id,
    p_cancelled_at
  ) on conflict (request_id) do nothing;
  perform public.enqueue_domain_outbox_event(
    v_operation.restaurant_id, 'billing_subscription', v_subscription.id,
    'subscription.status_changed',
    jsonb_build_object('from', v_from, 'to', 'cancelled', 'reasonCode', 'tenant_cancelled'),
    p_request_id || ':outbox:cancelled'
  );
  return jsonb_build_object('subscriptionId', v_subscription.id, 'duplicate', false);
end;
$$;

revoke all on function public.upsert_subscription_billing_profile(uuid,text,text,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.prepare_subscription_checkout_operation(uuid,text,text,text,text,text,text,jsonb,jsonb,text,bigint,timestamptz,timestamptz,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.mark_subscription_checkout_initialized(uuid,text) from public, anon, authenticated;
revoke all on function public.find_subscription_checkout_callback(text) from public, anon, authenticated;
revoke all on function public.finalize_subscription_checkout_operation(uuid,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.claim_subscription_billing_operation(uuid,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_subscription_billing_operation(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.mark_subscription_billing_operation_reconciliation(uuid,text) from public, anon, authenticated;
revoke all on function public.finalize_subscription_cancellation(uuid,timestamptz,uuid,text) from public, anon, authenticated;

grant execute on function public.upsert_subscription_billing_profile(uuid,text,text,text,text,text,text,jsonb,jsonb) to service_role;
grant execute on function public.prepare_subscription_checkout_operation(uuid,text,text,text,text,text,text,jsonb,jsonb,text,bigint,timestamptz,timestamptz,timestamptz,text,text) to service_role;
grant execute on function public.mark_subscription_checkout_initialized(uuid,text) to service_role;
grant execute on function public.find_subscription_checkout_callback(text) to service_role;
grant execute on function public.finalize_subscription_checkout_operation(uuid,text,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.claim_subscription_billing_operation(uuid,text,uuid,text,text) to service_role;
grant execute on function public.complete_subscription_billing_operation(uuid,jsonb) to service_role;
grant execute on function public.mark_subscription_billing_operation_reconciliation(uuid,text) to service_role;
grant execute on function public.finalize_subscription_cancellation(uuid,timestamptz,uuid,text) to service_role;

comment on table public.billing_provider_operations is
  'Service-role-only idempotency ledger for outbound SaaS billing provider calls; ambiguous failures require reconciliation.';
