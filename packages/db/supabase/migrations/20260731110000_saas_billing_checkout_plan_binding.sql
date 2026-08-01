-- Bind a hosted checkout callback to the exact provider plan reference used
-- before the redirect. The reference is durable so a config rotation between
-- initialization and callback cannot rebind or silently upgrade a checkout.

create function public.bind_subscription_checkout_provider_plan(
  p_operation_id uuid,
  p_expected_provider_plan_ref text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_existing_ref text;
begin
  if coalesce(char_length(btrim(p_expected_provider_plan_ref)), 0) not between 1 and 200 then
    raise exception 'billing_checkout_plan_binding_invalid' using errcode = '22023';
  end if;

  select * into v_operation
  from public.billing_provider_operations
  where id = p_operation_id
  for update;
  if not found
    or v_operation.operation_type <> 'checkout.initialize'
    or v_operation.status <> 'processing' then
    raise exception 'billing_checkout_operation_not_claimed' using errcode = 'P0002';
  end if;

  v_existing_ref := v_operation.result_sanitized->>'expectedProviderPlanRef';
  if v_existing_ref is not null
    and v_existing_ref is distinct from btrim(p_expected_provider_plan_ref) then
    raise exception 'billing_checkout_plan_binding_conflict' using errcode = 'P0001';
  end if;

  update public.billing_provider_operations
  set result_sanitized = result_sanitized || jsonb_build_object(
        'expectedProviderPlanRef', btrim(p_expected_provider_plan_ref)
      )
  where id = p_operation_id;
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
declare
  v_operation public.billing_provider_operations%rowtype;
  v_expected_provider_plan_ref text;
begin
  if coalesce(char_length(btrim(p_provider_checkout_ref)), 0) not between 1 and 200 then
    raise exception 'billing_checkout_reference_invalid' using errcode = '22023';
  end if;

  select * into v_operation
  from public.billing_provider_operations
  where provider = 'iyzico'
    and operation_type = 'checkout.initialize'
    and provider_checkout_ref = btrim(p_provider_checkout_ref);

  if not found then
    raise exception 'billing_checkout_operation_not_found' using errcode = 'P0002';
  end if;
  if v_operation.requested_plan not in ('starter', 'pro', 'enterprise') then
    raise exception 'billing_checkout_plan_binding_missing' using errcode = 'P0001';
  end if;
  v_expected_provider_plan_ref := v_operation.result_sanitized->>'expectedProviderPlanRef';
  if coalesce(char_length(btrim(v_expected_provider_plan_ref)), 0) not between 1 and 200 then
    raise exception 'billing_checkout_plan_binding_missing' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'operationId', v_operation.id,
    'restaurantId', v_operation.restaurant_id,
    'invoiceId', coalesce(v_operation.invoice_id, v_operation.id),
    'requestedPlan', v_operation.requested_plan,
    'expectedProviderPlanRef', v_expected_provider_plan_ref
  );
end;
$$;

create or replace function public.enforce_billing_checkout_plan_binding()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_expected text;
  v_actual text;
begin
  if new.operation_type = 'checkout.initialize'
    and new.status = 'succeeded'
    and old.status <> 'succeeded' then
    v_expected := old.result_sanitized->>'expectedProviderPlanRef';
    v_actual := new.result_sanitized->>'providerPlanRef';
    if coalesce(char_length(btrim(v_expected)), 0) not between 1 and 200
      or v_actual is distinct from v_expected then
      raise exception 'billing_checkout_provider_plan_mismatch' using errcode = 'P0001';
    end if;
    new.result_sanitized := new.result_sanitized || jsonb_build_object(
      'expectedProviderPlanRef', v_expected
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_billing_checkout_plan_binding
  on public.billing_provider_operations;
create trigger enforce_billing_checkout_plan_binding
  before update on public.billing_provider_operations
  for each row execute function public.enforce_billing_checkout_plan_binding();

revoke all on function public.bind_subscription_checkout_provider_plan(uuid, text)
  from public, anon, authenticated;
revoke all on function public.find_subscription_checkout_callback(text)
  from public, anon, authenticated;
revoke all on function public.enforce_billing_checkout_plan_binding()
  from public, anon, authenticated;
grant execute on function public.bind_subscription_checkout_provider_plan(uuid, text)
  to service_role;
grant execute on function public.find_subscription_checkout_callback(text)
  to service_role;

comment on function public.find_subscription_checkout_callback(text) is
  'Resolves a hosted checkout token to one durable tenant operation and its claimed paid plan.';
