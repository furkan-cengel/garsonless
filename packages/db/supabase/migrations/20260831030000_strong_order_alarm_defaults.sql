-- Strong order alarms are a creation-time default only. Existing restaurant
-- settings are intentionally left untouched and continue to use application
-- fallbacks when the notifications object is absent.

create or replace function public.create_restaurant_with_pro_trial(
  p_name text,
  p_slug text,
  p_intended_plan text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_restaurant public.restaurants%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_trial_days integer;
  v_now timestamptz := clock_timestamp();
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(p_slug) not between 2 and 80
    or (p_intended_plan is not null and p_intended_plan not in ('starter', 'plus', 'pro')) then
    raise exception 'restaurant_trial_input_invalid' using errcode = '22023';
  end if;

  select trial_days into v_trial_days from public.billing_platform_policies where id = 'default';
  if v_trial_days is null then raise exception 'billing_trial_policy_missing' using errcode = '55000'; end if;
  if exists (
    select 1 from public.restaurants where owner_id = v_owner and deleted_at is null
  ) then
    raise exception 'additional_location_requires_sales_activation' using errcode = '42501';
  end if;

  insert into public.restaurants (name, slug, owner_id, plan, settings)
  values (
    btrim(p_name), p_slug, v_owner, 'pro',
    jsonb_build_object('notifications', jsonb_build_object(
      'newOrderSound', true,
      'newOrderSoundPreset', 'masabu-alert',
      'newOrderSoundVolume', 70,
      'newOrderRepeatSeconds', 10,
      'newOrderRepeatMaxMinutes', 5,
      'newOrderPush', true,
      'newOrderToast', true,
      'serviceRequestAlert', true,
      'serviceRequestPush', false
    ))
  ) returning * into v_restaurant;

  insert into public.billing_subscriptions (
    restaurant_id, billing_customer_id, provider, plan, scheduled_plan, status,
    intended_plan, billing_interval, current_period_start, current_period_end, trial_ends_at
  ) values (
    v_restaurant.id, null, null, 'pro', null, 'trial',
    p_intended_plan, 'monthly', v_now, v_now + make_interval(days => v_trial_days),
    v_now + make_interval(days => v_trial_days)
  ) returning * into v_subscription;

  insert into public.tenant_lifecycle_events (
    restaurant_id, subscription_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, request_id, occurred_at
  ) values (
    v_restaurant.id, v_subscription.id, null, 'trial', 'tenant_owner',
    v_owner, 'restaurant_created', 'trial:create:' || v_restaurant.id, v_now
  );

  return jsonb_build_object(
    'restaurantId', v_restaurant.id,
    'subscriptionId', v_subscription.id,
    'plan', 'pro',
    'intendedPlan', p_intended_plan,
    'trialEndsAt', v_subscription.trial_ends_at
  );
end;
$$;

revoke all on function public.create_restaurant_with_pro_trial(text,text,text)
  from public, anon;
grant execute on function public.create_restaurant_with_pro_trial(text,text,text)
  to authenticated;

create or replace function public.create_restaurant_with_pro_trial_v2(
  p_name text,
  p_slug text,
  p_timezone text,
  p_intended_plan text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_restaurant public.restaurants%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_operation public.restaurant_onboarding_operations%rowtype;
  v_payload jsonb;
  v_result jsonb;
  v_trial_days integer;
  v_now timestamptz := clock_timestamp();
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null
    or char_length(btrim(coalesce(p_name, ''))) not between 1 and 100
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(p_slug) not between 1 and 50
    or not exists (select 1 from pg_timezone_names where name = p_timezone)
    or (p_intended_plan is not null and p_intended_plan not in ('starter', 'plus', 'pro')) then
    raise exception 'restaurant_onboarding_input_invalid' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'name', btrim(p_name), 'slug', p_slug, 'timezone', p_timezone, 'targetPlan', p_intended_plan
  );
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_request_id::text, 0));
  select * into v_operation from public.restaurant_onboarding_operations
    where owner_user_id = v_owner and request_id = p_request_id;
  if found then
    if v_operation.operation <> 'create' or v_operation.request_payload <> v_payload then
      raise exception 'onboarding_idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_set(v_operation.result, '{outcome}', '"replayed"'::jsonb);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));
  if exists (select 1 from public.restaurants where owner_id = v_owner and deleted_at is null) then
    raise exception 'additional_location_requires_sales_activation' using errcode = '42501';
  end if;
  select trial_days into v_trial_days from public.billing_platform_policies where id = 'default';
  if v_trial_days is null then raise exception 'billing_trial_policy_missing' using errcode = '55000'; end if;

  insert into public.restaurants (name, slug, owner_id, plan, timezone, settings)
  values (
    btrim(p_name), p_slug, v_owner, 'pro', p_timezone,
    jsonb_build_object('notifications', jsonb_build_object(
      'newOrderSound', true,
      'newOrderSoundPreset', 'masabu-alert',
      'newOrderSoundVolume', 70,
      'newOrderRepeatSeconds', 10,
      'newOrderRepeatMaxMinutes', 5,
      'newOrderPush', true,
      'newOrderToast', true,
      'serviceRequestAlert', true,
      'serviceRequestPush', false
    ))
  ) returning * into v_restaurant;

  insert into public.billing_subscriptions (
    restaurant_id, billing_customer_id, provider, plan, scheduled_plan, status,
    intended_plan, billing_interval, current_period_start, current_period_end, trial_ends_at
  ) values (
    v_restaurant.id, null, null, 'pro', null, 'trial', p_intended_plan, 'monthly',
    v_now, v_now + make_interval(days => v_trial_days), v_now + make_interval(days => v_trial_days)
  ) returning * into v_subscription;

  insert into public.tenant_lifecycle_events (
    restaurant_id, subscription_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, request_id, occurred_at
  ) values (
    v_restaurant.id, v_subscription.id, null, 'trial', 'tenant_owner',
    v_owner, 'restaurant_created', 'trial:create:' || v_restaurant.id, v_now
  );

  insert into public.restaurant_onboarding_states (
    restaurant_id, owner_user_id, status, current_step, completed_steps,
    target_plan, started_at, revision, updated_at
  ) values (
    v_restaurant.id, v_owner, 'in_progress', 'branding', array['business'],
    p_intended_plan, v_now, 1, v_now
  );

  v_result := jsonb_build_object(
    'outcome', 'saved',
    'snapshot', public.build_restaurant_onboarding_snapshot(v_restaurant.id)
  );
  insert into public.restaurant_onboarding_operations (
    owner_user_id, request_id, restaurant_id, operation, request_payload, result
  ) values (v_owner, p_request_id, v_restaurant.id, 'create', v_payload, v_result);
  return v_result;
end;
$$;

revoke all on function public.create_restaurant_with_pro_trial_v2(text,text,text,text,uuid) from public, anon;
grant execute on function public.create_restaurant_with_pro_trial_v2(text,text,text,text,uuid) to authenticated;
