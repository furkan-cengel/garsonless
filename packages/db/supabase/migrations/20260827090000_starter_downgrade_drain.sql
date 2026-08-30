-- Safe plan downgrade drain for support/admin transitions.
-- Production deployment is intentionally separate from creating this migration.

create or replace function public.request_platform_admin_tenant_plan_transition(
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
  v_open_session_count integer := 0;
  v_is_downgrade boolean := false;
  v_after jsonb;
  v_existing_after jsonb;
begin
  if coalesce(p_plan, '') not in ('starter', 'plus', 'pro', 'business') then
    raise exception 'platform_tenant_plan_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 or p_request_id is null then
    raise exception 'platform_tenant_plan_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id
  for update;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role
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
    return v_existing_after || jsonb_build_object(
      'duplicate', true,
      'requestedPlan', p_plan,
      'scheduled', coalesce((v_existing_after ->> 'scheduled')::boolean, false),
      'openSessionCount', coalesce((v_existing_after ->> 'openSessionCount')::integer, 0)
    );
  end if;

  select * into v_restaurant
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  v_previous_plan := v_restaurant.plan;
  v_is_downgrade := (
    case p_plan when 'starter' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end
    < case v_previous_plan when 'starter' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end
  );

  -- Existing upgrade/no-op policy remains owned by the established command.
  if not v_is_downgrade then
    v_after := public.set_platform_admin_tenant_plan(
      p_restaurant_id,
      p_actor_user_id,
      p_actor_role,
      p_plan,
      p_reason,
      p_request_id
    );
    return v_after || jsonb_build_object(
      'requestedPlan', p_plan,
      'scheduled', false,
      'openSessionCount', 0
    );
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled'
  order by created_at desc
  limit 1
  for update;

  -- Provider-managed subscriptions must first be changed and confirmed by the
  -- billing integration. An admin transition may never create local/provider
  -- plan drift, including while scheduling a downgrade drain.
  if v_subscription.id is not null
    and v_subscription.provider = 'iyzico'
    and v_previous_plan <> p_plan then
    raise exception 'platform_tenant_plan_billing_managed' using errcode = '55000';
  end if;

  select count(*)::integer into v_open_session_count
  from public.table_sessions
  where restaurant_id = p_restaurant_id and closed_at is null;

  if v_open_session_count > 0 then
    if v_subscription.id is null then
      insert into public.billing_subscriptions (
        restaurant_id,
        billing_customer_id,
        provider,
        plan,
        scheduled_plan,
        status,
        billing_interval
      ) values (
        p_restaurant_id,
        null,
        null,
        v_previous_plan,
        p_plan,
        'active',
        'monthly'
      ) returning * into v_subscription;
    else
      update public.billing_subscriptions
      set scheduled_plan = p_plan,
          version = version + 1,
          updated_at = clock_timestamp()
      where id = v_subscription.id
      returning * into v_subscription;
    end if;

    v_after := jsonb_build_object(
      'restaurantId', p_restaurant_id,
      'previousPlan', v_previous_plan,
      'requestedPlan', p_plan,
      'plan', v_previous_plan,
      'changed', false,
      'scheduled', true,
      'openSessionCount', v_open_session_count,
      'duplicate', false,
      'requestId', p_request_id
    );
  else
    if v_subscription.id is not null then
      update public.billing_subscriptions
      set plan = p_plan,
          scheduled_plan = null,
          intended_plan = null,
          status = 'active',
          trial_ends_at = null,
          version = version + 1,
          updated_at = clock_timestamp()
      where id = v_subscription.id
      returning * into v_subscription;
    end if;

    update public.restaurants
    set plan = p_plan
    where id = p_restaurant_id;

    if v_previous_plan = 'business' and p_plan <> 'business' then
      delete from public.organization_restaurants
      where restaurant_id = p_restaurant_id;
    end if;

    v_after := jsonb_build_object(
      'restaurantId', p_restaurant_id,
      'previousPlan', v_previous_plan,
      'requestedPlan', p_plan,
      'plan', p_plan,
      'changed', true,
      'scheduled', false,
      'openSessionCount', 0,
      'duplicate', false,
      'requestId', p_request_id
    );
  end if;

  insert into public.platform_admin_audit_log (
    actor_user_id,
    actor_role,
    action,
    target_type,
    target_id,
    reason,
    request_id,
    before_state,
    after_state
  ) values (
    p_actor_user_id,
    v_identity.role,
    'tenant.plan.change',
    'restaurant',
    p_restaurant_id::text,
    btrim(p_reason),
    p_request_id,
    jsonb_build_object(
      'plan', v_previous_plan,
      'subscriptionManaged', v_subscription.id is not null,
      'openSessionCount', v_open_session_count
    ),
    v_after
  );

  return v_after;
end;
$$;

revoke all on function public.request_platform_admin_tenant_plan_transition(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.request_platform_admin_tenant_plan_transition(uuid,uuid,text,text,text,uuid)
  to service_role;

-- One service-role read powers both public and staff order ingress. During a
-- scheduled downgrade it fails closed before cart validation or any write.
create or replace function public.read_tenant_order_ingress_status(
  p_restaurant_id uuid
)
returns text
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if not exists (
    select 1 from public.restaurants
    where id = p_restaurant_id and deleted_at is null
  ) then
    return 'unavailable';
  end if;

  if exists (
    select 1
    from public.billing_subscriptions subscription
    where subscription.restaurant_id = p_restaurant_id
      and subscription.status <> 'cancelled'
      and subscription.scheduled_plan is not null
      and case subscription.scheduled_plan when 'starter' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end
        < case subscription.plan when 'starter' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end
  ) then
    return 'manual_hold';
  end if;

  select status into v_status
  from public.tenant_service_controls
  where restaurant_id = p_restaurant_id;
  return coalesce(v_status, 'active');
end;
$$;

revoke all on function public.read_tenant_order_ingress_status(uuid)
  from public, anon, authenticated;
grant execute on function public.read_tenant_order_ingress_status(uuid)
  to service_role;

-- Database backstop: callers cannot bypass the application ingress guard with
-- a direct service-role insert while a downgrade is draining.
create or replace function public.reject_new_order_while_plan_downgrade_drains()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.read_tenant_order_ingress_status(new.restaurant_id) = 'manual_hold'
    and exists (
      select 1
      from public.billing_subscriptions subscription
      where subscription.restaurant_id = new.restaurant_id
        and subscription.status <> 'cancelled'
        and subscription.scheduled_plan is not null
        and case subscription.scheduled_plan when 'starter' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end
          < case subscription.plan when 'starter' then 0 when 'plus' then 1 when 'pro' then 2 else 3 end
    ) then
    raise exception 'subscription_downgrade_draining' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_reject_plan_downgrade_drain on public.orders;
create trigger orders_reject_plan_downgrade_drain
  before insert on public.orders
  for each row execute function public.reject_new_order_while_plan_downgrade_drains();

revoke all on function public.reject_new_order_while_plan_downgrade_drains()
  from public, anon, authenticated;

-- Keep session creation closed as well. Existing sessions remain readable and
-- can be settled/closed because those paths do not call this function.
create or replace function public.open_or_get_table_session(
  p_restaurant_id uuid,
  p_table_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform 1
  from public.tables table_row
  where table_row.id = p_table_id
    and table_row.restaurant_id = p_restaurant_id
    and table_row.deleted_at is null
  for key share;

  if not found then
    raise exception 'table_not_found_for_restaurant' using errcode = 'P0002';
  end if;

  update public.table_sessions session
  set closed_at = now(), updated_at = now()
  where session.restaurant_id = p_restaurant_id
    and session.table_id = p_table_id
    and session.closed_at is null
    and session.opened_at < now() - interval '8 hours'
    and not exists (
      select 1 from public.orders order_row
      where order_row.table_session_id = session.id
        and order_row.restaurant_id = p_restaurant_id
        and order_row.created_at > now() - interval '8 hours'
    );

  select id into v_id
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_id = p_table_id
    and closed_at is null
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  if public.read_tenant_order_ingress_status(p_restaurant_id) <> 'active' then
    raise exception 'new_table_session_blocked' using errcode = '55000';
  end if;

  insert into public.table_sessions (restaurant_id, table_id)
  values (p_restaurant_id, p_table_id)
  on conflict (table_id) where (closed_at is null) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.table_sessions
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and closed_at is null
    limit 1;
  end if;

  if v_id is null then
    raise exception 'failed_to_open_table_session';
  end if;
  return v_id;
end;
$$;

revoke all on function public.open_or_get_table_session(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.open_or_get_table_session(uuid, uuid)
  to service_role;
