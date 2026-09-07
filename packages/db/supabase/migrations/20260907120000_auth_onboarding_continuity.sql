-- Preserve acquisition intent and drafts without publishing menu items.
alter table public.restaurant_onboarding_states
  add column target_billing_interval text not null default 'monthly'
    check (target_billing_interval in ('monthly','yearly')),
  add column menu_draft jsonb null check (menu_draft is null or (jsonb_typeof(menu_draft) = 'object' and octet_length(menu_draft::text) <= 1048576));

update public.restaurant_onboarding_states state
set target_billing_interval = case when subscription.billing_interval = 'annual' then 'yearly' else 'monthly' end
from public.billing_subscriptions subscription
where subscription.id = (select latest.id from public.billing_subscriptions latest where latest.restaurant_id = state.restaurant_id order by latest.created_at desc limit 1);

alter table public.restaurant_onboarding_operations drop constraint restaurant_onboarding_operations_operation_check;
alter table public.restaurant_onboarding_operations add constraint restaurant_onboarding_operations_operation_check
  check (operation in ('create','branding','manual_menu','csv_menu','dismiss_checklist','draft'));

create or replace function public.has_current_signup_legal_evidence()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists (select 1 from public.legal_document_acceptances where user_id = auth.uid()
   and document_type = 'b2b_terms' and document_version = '2026-08-16');
$$;
revoke all on function public.has_current_signup_legal_evidence() from public, anon;
grant execute on function public.has_current_signup_legal_evidence() to authenticated;

create or replace function public.assert_dashboard_onboarding_identity()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
   and coalesce(raw_app_meta_data->>'dashboard_signup_email_verification_required','false') <> 'true') then
   raise exception 'signup_email_verification_required' using errcode = '42501';
 end if;
 if not public.has_current_signup_legal_evidence() then
   raise exception 'signup_legal_evidence_required' using errcode = '42501';
 end if;
end;
$$;
revoke all on function public.assert_dashboard_onboarding_identity() from public, anon, authenticated;

create or replace function public.build_restaurant_onboarding_snapshot(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', state.status,
    'restaurantId', restaurant.id,
    'restaurantName', restaurant.name,
    'slug', restaurant.slug,
    'logoUrl', restaurant.logo_url,
    'accent', coalesce(theme.tokens ->> 'accent', '#2e7d52'),
    'currentStep', state.current_step,
    'completedSteps', to_jsonb(state.completed_steps),
    'menuEntryMethod', state.menu_entry_method,
    'targetPlan', state.target_plan,
    'targetBillingInterval', state.target_billing_interval,
    'menuDraft', case when state.status = 'completed' then null else state.menu_draft end,
    'trialEndsAt', subscription.trial_ends_at,
    'startedAt', state.started_at,
    'completedAt', state.completed_at,
    'revision', state.revision,
    'categoryCount', (
      select count(*) from public.menu_categories category
      where category.restaurant_id = restaurant.id and category.deleted_at is null
    ),
    'itemCount', (
      select count(*) from public.menu_items item
      join public.menu_categories category on category.id = item.category_id
      where category.restaurant_id = restaurant.id
        and category.deleted_at is null and item.deleted_at is null
    ),
    'checklistDismissedAt', state.checklist_dismissed_at
  )
  from public.restaurant_onboarding_states state
  join public.restaurants restaurant on restaurant.id = state.restaurant_id
  left join public.theme_configs theme on theme.restaurant_id = restaurant.id
  left join lateral (
    select billing.trial_ends_at
    from public.billing_subscriptions billing
    where billing.restaurant_id = restaurant.id
    order by billing.created_at desc
    limit 1
  ) subscription on true
  where state.restaurant_id = p_restaurant_id
    and restaurant.deleted_at is null;
$$;
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
  perform public.assert_dashboard_onboarding_identity();
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
  perform public.assert_dashboard_onboarding_identity();
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
create or replace function public.create_restaurant_with_pro_trial_v3(
  p_name text,
  p_slug text,
  p_timezone text,
  p_intended_plan text,
  p_request_id uuid,
  p_intended_interval text
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
  perform public.assert_dashboard_onboarding_identity();
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_intended_interval is null or p_intended_interval not in ('monthly','yearly') or p_request_id is null
    or char_length(btrim(coalesce(p_name, ''))) not between 1 and 100
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(p_slug) not between 1 and 50
    or not exists (select 1 from pg_timezone_names where name = p_timezone)
    or (p_intended_plan is not null and p_intended_plan not in ('starter', 'plus', 'pro')) then
    raise exception 'restaurant_onboarding_input_invalid' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'name', btrim(p_name), 'slug', p_slug, 'timezone', p_timezone, 'targetPlan', p_intended_plan, 'targetBillingInterval', p_intended_interval
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
    v_restaurant.id, null, null, 'pro', null, 'trial', p_intended_plan, case when p_intended_interval = 'yearly' then 'annual' else 'monthly' end,
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
    target_plan, target_billing_interval, started_at, revision, updated_at
  ) values (
    v_restaurant.id, v_owner, 'in_progress', 'branding', array['business'],
    p_intended_plan, p_intended_interval, v_now, 1, v_now
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
revoke all on function public.create_restaurant_with_pro_trial_v3(text,text,text,text,uuid,text) from public, anon;
grant execute on function public.create_restaurant_with_pro_trial_v3(text,text,text,text,uuid,text) to authenticated;

create or replace function public.save_restaurant_onboarding_draft(
 p_restaurant_id uuid, p_draft jsonb, p_expected_revision integer, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 v_owner uuid := auth.uid();
 v_state public.restaurant_onboarding_states%rowtype;
 v_operation public.restaurant_onboarding_operations%rowtype;
 v_payload jsonb;
 v_result jsonb;
 v_row jsonb;
begin
 if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision < 0
   or p_draft is null or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text) > 1048576
   or not (p_draft ?& array['mode','categoryName','itemName','price','description','csvFileName','csvRows'])
   or (select count(*) from jsonb_object_keys(p_draft)) <> 7
   or jsonb_typeof(p_draft->'mode') <> 'string'
   or p_draft->>'mode' not in ('manual','csv')
   or jsonb_typeof(p_draft->'csvRows') <> 'array' then
   raise exception 'onboarding_draft_invalid' using errcode = '22023';
 end if;
 if jsonb_array_length(p_draft->'csvRows') > 1000
   or jsonb_typeof(p_draft->'categoryName') <> 'string' or length(p_draft->>'categoryName') > 100
   or jsonb_typeof(p_draft->'itemName') <> 'string' or length(p_draft->>'itemName') > 100
   or jsonb_typeof(p_draft->'price') <> 'string' or length(p_draft->>'price') > 64
   or jsonb_typeof(p_draft->'description') <> 'string' or length(p_draft->>'description') > 500
   or jsonb_typeof(p_draft->'csvFileName') <> 'string' or length(p_draft->>'csvFileName') > 255 then
   raise exception 'onboarding_draft_invalid' using errcode = '22023';
 end if;
 for v_row in select value from jsonb_array_elements(p_draft->'csvRows') loop
   if jsonb_typeof(v_row) <> 'object'
     or not (v_row ?& array['sourceRow','category','name','description','price','error'])
     or (select count(*) from jsonb_object_keys(v_row)) <> 6
     or jsonb_typeof(v_row->'sourceRow') <> 'number'
     or (v_row->>'sourceRow') !~ '^[0-9]+$'
     or length(v_row->>'sourceRow') > 9
     or jsonb_typeof(v_row->'category') <> 'string' or length(v_row->>'category') > 100
     or jsonb_typeof(v_row->'name') <> 'string' or length(v_row->>'name') > 100
     or jsonb_typeof(v_row->'description') <> 'string' or length(v_row->>'description') > 500
     or jsonb_typeof(v_row->'price') <> 'string' or length(v_row->>'price') > 64
     or jsonb_typeof(v_row->'error') not in ('string','null')
     or length(v_row->>'error') > 500 then
     raise exception 'onboarding_draft_invalid' using errcode = '22023';
   end if;
 end loop;
 v_payload := jsonb_build_object('restaurantId',p_restaurant_id,'draft',p_draft,'expectedRevision',p_expected_revision);
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_request_id::text,0));
 select * into v_operation from public.restaurant_onboarding_operations where owner_user_id=v_owner and request_id=p_request_id;
 if found then
   if v_operation.operation <> 'draft' or v_operation.request_payload <> v_payload then
     raise exception 'onboarding_idempotency_conflict' using errcode = '22023';
   end if;
   return jsonb_set(v_operation.result,'{outcome}','"replayed"'::jsonb);
 end if;
 select state.* into v_state from public.restaurant_onboarding_states state
 join public.restaurants restaurant on restaurant.id=state.restaurant_id
 where state.restaurant_id=p_restaurant_id and state.owner_user_id=v_owner
   and restaurant.owner_id=v_owner and restaurant.deleted_at is null
 for update of state;
 if not found then raise exception 'not_authorized' using errcode='42501'; end if;
 if v_state.revision <> p_expected_revision then
   v_result := jsonb_build_object('outcome','conflict','snapshot',public.build_restaurant_onboarding_snapshot(p_restaurant_id));
 elsif v_state.status <> 'in_progress' or v_state.current_step <> 'menu' then
   raise exception 'onboarding_transition_invalid' using errcode='22023';
 else
   update public.restaurant_onboarding_states set menu_draft=p_draft, revision=revision+1, updated_at=clock_timestamp() where restaurant_id=p_restaurant_id;
   v_result := jsonb_build_object('outcome','saved','snapshot',public.build_restaurant_onboarding_snapshot(p_restaurant_id));
 end if;
 insert into public.restaurant_onboarding_operations(owner_user_id,request_id,restaurant_id,operation,request_payload,result)
 values(v_owner,p_request_id,p_restaurant_id,'draft',v_payload,v_result);
 return v_result;
end;
$$;
revoke all on function public.save_restaurant_onboarding_draft(uuid,jsonb,integer,uuid) from public, anon;
grant execute on function public.save_restaurant_onboarding_draft(uuid,jsonb,integer,uuid) to authenticated;

-- GoTrue shares the underlying token storage for recovery and magic links.
-- Only the signed send-email hook may attest that a token was issued for recovery.
create table public.dashboard_recovery_email_intents (
 token_hash text primary key check (length(token_hash) between 20 and 256),
 otp_digest text not null unique check (length(otp_digest) = 64),
 user_id uuid not null references auth.users(id) on delete cascade,
 email text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '1 hour')
);
alter table public.dashboard_recovery_email_intents enable row level security;
revoke all on public.dashboard_recovery_email_intents from public, anon, authenticated;
grant select, insert, update, delete on public.dashboard_recovery_email_intents to service_role;
create index dashboard_recovery_email_intents_expiry_idx on public.dashboard_recovery_email_intents(expires_at);
