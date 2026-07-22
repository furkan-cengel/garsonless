-- Owner-facing SaaS billing projection (Faz 5.5).
-- The dashboard resolves owner authority before invoking this service-role-only
-- function. Provider references, raw provider payloads and internal error text
-- are intentionally excluded from the returned JSON.

create or replace function public.read_subscription_billing_settings(
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.billing_customers%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_profile jsonb := null;
  v_subscription_json jsonb := null;
  v_invoices jsonb := '[]'::jsonb;
  v_reconciliation_count integer := 0;
  v_has_pending_checkout boolean := false;
  v_next_dunning_action_at timestamptz;
begin
  if not exists (
    select 1 from public.restaurants
    where id = p_restaurant_id and deleted_at is null
  ) then
    raise exception 'billing_restaurant_not_found' using errcode = 'P0002';
  end if;

  select * into v_customer
  from public.billing_customers
  where restaurant_id = p_restaurant_id;

  if found
    and v_customer.profile_completed_at is not null
    and v_customer.contact_name is not null
    and v_customer.contact_surname is not null
    and v_customer.identity_number is not null
    and v_customer.gsm_number is not null
    and v_customer.billing_address is not null
    and v_customer.shipping_address is not null then
    v_profile := jsonb_build_object(
      'legalName', v_customer.legal_name,
      'name', v_customer.contact_name,
      'surname', v_customer.contact_surname,
      'identityNumber', v_customer.identity_number,
      'email', v_customer.contact_email,
      'gsmNumber', v_customer.gsm_number,
      'billingAddress', v_customer.billing_address,
      'shippingAddress', v_customer.shipping_address
    );
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where restaurant_id = p_restaurant_id
  order by (status <> 'cancelled') desc, created_at desc
  limit 1;

  if found then
    v_subscription_json := jsonb_build_object(
      'id', v_subscription.id,
      'plan', v_subscription.plan,
      'scheduledPlan', v_subscription.scheduled_plan,
      'status', v_subscription.status,
      'currentPeriodStart', v_subscription.current_period_start,
      'currentPeriodEnd', v_subscription.current_period_end,
      'trialEndsAt', v_subscription.trial_ends_at,
      'graceEndsAt', v_subscription.grace_ends_at,
      'cancelledAt', v_subscription.cancelled_at
    );
  end if;

  select coalesce(jsonb_agg(invoice_row order by created_at desc), '[]'::jsonb)
  into v_invoices
  from (
    select
      id,
      plan,
      amount_due_minor as "amountDueMinor",
      amount_paid_minor as "amountPaidMinor",
      currency,
      status,
      period_start as "periodStart",
      period_end as "periodEnd",
      due_at as "dueAt",
      paid_at as "paidAt",
      failed_at as "failedAt",
      (status = 'past_due' and provider_invoice_ref is not null) as "canRetry",
      created_at
    from public.subscription_invoices
    where restaurant_id = p_restaurant_id
    order by created_at desc
    limit 12
  ) invoice_row;

  select
    (select count(*)::integer
      from public.billing_reconciliation_jobs
      where restaurant_id = p_restaurant_id
        and status in ('pending', 'running', 'discrepancy', 'failed'))
    +
    (select count(*)::integer
      from public.billing_provider_operations
      where restaurant_id = p_restaurant_id
        and status = 'requires_reconciliation')
  into v_reconciliation_count;

  select exists (
    select 1 from public.billing_provider_operations
    where restaurant_id = p_restaurant_id and status = 'awaiting_callback'
  ) into v_has_pending_checkout;

  select min(next_action_at) into v_next_dunning_action_at
  from public.dunning_runs
  where restaurant_id = p_restaurant_id
    and status in ('scheduled', 'failed')
    and next_action_at is not null;

  return jsonb_build_object(
    'profile', v_profile,
    'subscription', v_subscription_json,
    'invoices', v_invoices,
    'attention', jsonb_build_object(
      'reconciliationCount', v_reconciliation_count,
      'hasPendingCheckout', v_has_pending_checkout,
      'nextDunningActionAt', v_next_dunning_action_at
    )
  );
end;
$$;

revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;
grant execute on function public.read_subscription_billing_settings(uuid)
  to service_role;

comment on function public.read_subscription_billing_settings(uuid) is
  'Service-role-only owner billing projection without provider references, raw payloads or internal diagnostics.';
