-- Faz 6.4: audited platform tenant plan projection management.
-- Paid/live subscription plans remain provider-owned. This RPC is only a
-- superadmin correction/grant path for tenants without a live subscription.

create or replace function public.set_platform_admin_tenant_plan(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_plan text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_previous_plan text;
  v_changed boolean;
  v_after jsonb;
  v_existing_after jsonb;
begin
  if coalesce(p_plan, '') not in ('free', 'starter', 'pro', 'enterprise') then
    raise exception 'platform_tenant_plan_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_tenant_plan_reason_invalid' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'platform_tenant_plan_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id
  for update;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role <> 'superadmin' then
    raise exception 'platform_tenant_plan_not_authorized' using errcode = '42501';
  end if;

  select after_state into v_existing_after
  from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id
    and request_id = p_request_id
    and action = 'tenant.plan.change'
    and target_type = 'restaurant'
    and target_id = p_restaurant_id::text;
  if found then
    return v_existing_after || jsonb_build_object('duplicate', true);
  end if;

  select * into v_restaurant
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  -- A provider-backed subscription is the payment and plan authority. Mutating
  -- only local state here would silently grant a capability the provider has
  -- not charged for (or charge for one that was removed).
  select * into v_subscription
  from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled'
  order by created_at desc
  limit 1
  for update;

  v_previous_plan := v_restaurant.plan;
  v_changed := v_previous_plan <> p_plan;
  if v_subscription.id is not null and v_changed then
    raise exception 'platform_tenant_plan_billing_managed' using errcode = '55000';
  end if;

  if v_changed then
    update public.restaurants
    set plan = p_plan
    where id = p_restaurant_id
    returning * into v_restaurant;
  end if;

  v_after := jsonb_build_object(
    'restaurantId', p_restaurant_id,
    'previousPlan', v_previous_plan,
    'plan', p_plan,
    'changed', v_changed,
    'duplicate', false,
    'requestId', p_request_id
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_actor_user_id, v_identity.role, 'tenant.plan.change', 'restaurant',
    p_restaurant_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object(
      'plan', v_previous_plan,
      'subscriptionManaged', v_subscription.id is not null
    ),
    v_after
  );

  return v_after;
end;
$$;

revoke all on function public.set_platform_admin_tenant_plan(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.set_platform_admin_tenant_plan(uuid,uuid,text,text,text,uuid)
  to service_role;

comment on function public.set_platform_admin_tenant_plan(uuid,uuid,text,text,text,uuid) is
  'Superadmin-only audited plan projection correction; rejects live provider-managed subscriptions.';
