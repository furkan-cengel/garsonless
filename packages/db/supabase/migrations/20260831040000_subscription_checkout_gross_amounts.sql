-- Align plan-only hosted checkout persistence with iyzico's KDV-inclusive
-- pricing-plan amounts. The application, provider plan and invoice must carry
-- the same gross TRY minor-unit amount.

begin;

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
  p_billing_interval text,
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
  v_expected_amount bigint;
begin
  v_expected_amount := case p_plan || ':' || p_billing_interval
    when 'starter:monthly' then 41880 when 'starter:annual' then 402048
    when 'plus:monthly' then 83880 when 'plus:annual' then 805248
    when 'pro:monthly' then 143880 when 'pro:annual' then 1381248
    else null
  end;
  if v_expected_amount is null or p_amount_minor <> v_expected_amount
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
    request_fingerprint, status, requested_plan, billing_interval,
    amount_minor, currency, period_start, period_end, due_at
  ) values (
    p_restaurant_id, v_customer.id, 'checkout.initialize', p_idempotency_key,
    p_request_fingerprint, 'processing', p_plan, p_billing_interval,
    p_amount_minor, 'TRY', p_period_start, p_period_end, p_due_at
  ) returning * into v_operation;

  return jsonb_build_object(
    'operationId', v_operation.id, 'customerId', v_customer.id,
    'invoiceId', v_operation.id, 'plan', p_plan, 'interval', p_billing_interval,
    'amountMinor', p_amount_minor, 'currency', 'TRY', 'status', v_operation.status,
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

comment on function public.prepare_subscription_checkout_operation(
  uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,
  timestamptz,timestamptz,timestamptz,text,text
) is 'Prepares an iyzico plan checkout using the canonical KDV-inclusive provider amount.';

commit;
