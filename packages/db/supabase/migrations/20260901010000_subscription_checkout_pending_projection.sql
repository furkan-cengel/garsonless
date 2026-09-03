-- Successful checkout completion supersedes older abandoned browser sessions.
-- Keep the durable operation rows for audit/reconciliation, but do not present
-- them to owners as a currently pending checkout.

alter function public.read_subscription_billing_settings(uuid)
  rename to read_subscription_billing_settings_before_pending_projection;

revoke all on function public.read_subscription_billing_settings_before_pending_projection(uuid)
  from public, anon, authenticated, service_role;

create function public.read_subscription_billing_settings(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb;
  v_has_pending_checkout boolean;
begin
  v_settings := public.read_subscription_billing_settings_before_pending_projection(p_restaurant_id);

  select exists (
    select 1
    from public.billing_provider_operations pending
    where pending.restaurant_id = p_restaurant_id
      and pending.operation_type = 'checkout.initialize'
      and pending.status = 'awaiting_callback'
      and pending.updated_at >= now() - interval '24 hours'
      and not exists (
        select 1
        from public.billing_provider_operations completed
        where completed.restaurant_id = pending.restaurant_id
          and completed.operation_type = 'checkout.initialize'
          and completed.status = 'succeeded'
          and coalesce(completed.completed_at, completed.updated_at) > pending.created_at
      )
  ) into v_has_pending_checkout;

  return jsonb_set(
    v_settings,
    '{attention,hasPendingCheckout}',
    to_jsonb(v_has_pending_checkout),
    true
  );
end;
$$;

revoke all on function public.read_subscription_billing_settings(uuid)
  from public, anon, authenticated;
grant execute on function public.read_subscription_billing_settings(uuid)
  to service_role;
