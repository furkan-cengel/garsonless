-- Repair add-on checkout preparation after the lifecycle migration started
-- referring to a physical expected_provider_plan_ref column that does not
-- exist. The exact provider plan remains bound through the established
-- result_sanitized.expectedProviderPlanRef contract before provider dispatch.

begin;

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
      or (
        v_existing.result_sanitized ? 'expectedProviderPlanRef'
        and v_existing.result_sanitized->>'expectedProviderPlanRef'
          is distinct from btrim(p_expected_provider_plan_ref)
      ) then
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

comment on function public.prepare_subscription_checkout_with_add_ons_operation(
  uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,
  timestamptz,timestamptz,timestamptz,text,text,text[],text
) is 'Prepares an exact catalogue-bound add-on checkout; the provider plan reference is bound separately before dispatch.';

commit;
