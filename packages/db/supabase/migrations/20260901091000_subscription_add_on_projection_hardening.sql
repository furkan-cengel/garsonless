-- Phase 4a hardening: a subscription without a scheduled change must project
-- an empty add-on target, never a SQL NULL that nulls the entire settings JSON.

begin;

create or replace function public.read_subscription_billing_settings(p_restaurant_id uuid)
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

revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;
grant execute on function public.read_subscription_billing_settings(uuid) to service_role;

comment on function public.read_subscription_billing_settings(uuid) is
  'Owner billing projection with non-null active/scheduled add-on snapshots and invoice add-on evidence.';

commit;
