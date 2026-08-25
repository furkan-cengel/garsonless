-- Activation-focused, resumable owner onboarding.
-- Additive: the legacy create_restaurant_with_pro_trial RPC remains available
-- during the client migration window.

create table if not exists public.restaurant_onboarding_states (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('not_started', 'in_progress', 'completed')),
  current_step text not null default 'business'
    check (current_step in ('business', 'branding', 'menu', 'complete')),
  completed_steps text[] not null default '{}',
  menu_entry_method text null
    check (menu_entry_method is null or menu_entry_method in ('manual', 'csv')),
  target_plan text null
    check (target_plan is null or target_plan in ('starter', 'plus', 'pro')),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz null,
  checklist_dismissed_at timestamptz null,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  check ((status = 'completed') = (current_step = 'complete')),
  check ((status = 'completed') = (completed_at is not null))
);

create table if not exists public.restaurant_onboarding_operations (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  restaurant_id uuid null references public.restaurants(id) on delete cascade,
  operation text not null check (operation in ('create', 'branding', 'manual_menu', 'csv_menu', 'dismiss_checklist')),
  request_payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (owner_user_id, request_id)
);

create index if not exists restaurant_onboarding_operations_restaurant_created_idx
  on public.restaurant_onboarding_operations (restaurant_id, created_at desc);

alter table public.restaurant_onboarding_states enable row level security;
alter table public.restaurant_onboarding_states force row level security;
alter table public.restaurant_onboarding_operations enable row level security;
alter table public.restaurant_onboarding_operations force row level security;
revoke all on public.restaurant_onboarding_states from public, anon, authenticated;
revoke all on public.restaurant_onboarding_operations from public, anon, authenticated;

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

revoke all on function public.build_restaurant_onboarding_snapshot(uuid) from public, anon, authenticated;

create or replace function public.read_owner_restaurant_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_restaurant_id uuid;
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select state.restaurant_id into v_restaurant_id
  from public.restaurant_onboarding_states state
  join public.restaurants restaurant on restaurant.id = state.restaurant_id
  where state.owner_user_id = v_owner
    and restaurant.owner_id = v_owner
    and restaurant.deleted_at is null
  order by state.started_at desc
  limit 1;
  if v_restaurant_id is null then return null; end if;
  return public.build_restaurant_onboarding_snapshot(v_restaurant_id);
end;
$$;

revoke all on function public.read_owner_restaurant_onboarding() from public, anon;
grant execute on function public.read_owner_restaurant_onboarding() to authenticated;

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

  insert into public.restaurants (name, slug, owner_id, plan, timezone)
  values (btrim(p_name), p_slug, v_owner, 'pro', p_timezone)
  returning * into v_restaurant;

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

create or replace function public.advance_restaurant_onboarding_branding(
  p_restaurant_id uuid,
  p_accent text,
  p_theme jsonb,
  p_expected_revision integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.restaurant_onboarding_states%rowtype;
  v_operation public.restaurant_onboarding_operations%rowtype;
  v_payload jsonb;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null or p_expected_revision < 0 or p_accent !~ '^#[0-9a-fA-F]{6}$'
    or jsonb_typeof(p_theme) <> 'object' or lower(p_theme ->> 'accent') <> lower(p_accent) then
    raise exception 'onboarding_input_invalid' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object(
    'restaurantId', p_restaurant_id, 'accent', lower(p_accent),
    'theme', p_theme, 'expectedRevision', p_expected_revision
  );
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_request_id::text, 0));
  select * into v_operation from public.restaurant_onboarding_operations
    where owner_user_id = v_owner and request_id = p_request_id;
  if found then
    if v_operation.operation <> 'branding' or v_operation.request_payload <> v_payload then
      raise exception 'onboarding_idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_set(v_operation.result, '{outcome}', '"replayed"'::jsonb);
  end if;

  select state.* into v_state
  from public.restaurant_onboarding_states state
  join public.restaurants restaurant on restaurant.id = state.restaurant_id
  where state.restaurant_id = p_restaurant_id and state.owner_user_id = v_owner
    and restaurant.owner_id = v_owner and restaurant.deleted_at is null
  for update of state;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_state.revision <> p_expected_revision then
    v_result := jsonb_build_object('outcome', 'conflict', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  elsif v_state.status <> 'in_progress' or v_state.current_step <> 'branding' then
    raise exception 'onboarding_transition_invalid' using errcode = '22023';
  else
    insert into public.theme_configs (
      restaurant_id, tokens, component_overrides, revision, published_at, updated_at, updated_by
    ) values (
      p_restaurant_id, p_theme || jsonb_build_object('__template_id', 'default'), '{}'::jsonb,
      1, clock_timestamp(), clock_timestamp(), v_owner
    )
    on conflict (restaurant_id) do update
      set tokens = excluded.tokens,
          revision = public.theme_configs.revision + 1,
          published_at = clock_timestamp(),
          updated_at = clock_timestamp(),
          updated_by = v_owner;
    update public.restaurant_onboarding_states
      set current_step = 'menu', completed_steps = array_append(completed_steps, 'branding'),
          revision = revision + 1, updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id;
    v_result := jsonb_build_object('outcome', 'saved', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  end if;
  insert into public.restaurant_onboarding_operations (
    owner_user_id, request_id, restaurant_id, operation, request_payload, result
  ) values (v_owner, p_request_id, p_restaurant_id, 'branding', v_payload, v_result);
  return v_result;
end;
$$;

revoke all on function public.advance_restaurant_onboarding_branding(uuid,text,jsonb,integer,uuid) from public, anon;
grant execute on function public.advance_restaurant_onboarding_branding(uuid,text,jsonb,integer,uuid) to authenticated;

create or replace function public.create_onboarding_first_menu_item(
  p_restaurant_id uuid,
  p_category_name text,
  p_item_name text,
  p_price numeric,
  p_description text,
  p_expected_revision integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.restaurant_onboarding_states%rowtype;
  v_operation public.restaurant_onboarding_operations%rowtype;
  v_category public.menu_categories%rowtype;
  v_payload jsonb;
  v_result jsonb;
  v_position integer;
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null or p_expected_revision < 0
    or char_length(btrim(coalesce(p_category_name, ''))) not between 1 and 100
    or char_length(btrim(coalesce(p_item_name, ''))) not between 1 and 100
    or char_length(coalesce(p_description, '')) > 500
    or p_price is null or p_price <= 0 or p_price > 99999999 then
    raise exception 'onboarding_menu_input_invalid' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object(
    'restaurantId', p_restaurant_id, 'categoryName', btrim(p_category_name),
    'itemName', btrim(p_item_name), 'price', p_price,
    'description', nullif(btrim(coalesce(p_description, '')), ''), 'expectedRevision', p_expected_revision
  );
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_request_id::text, 0));
  select * into v_operation from public.restaurant_onboarding_operations
    where owner_user_id = v_owner and request_id = p_request_id;
  if found then
    if v_operation.operation <> 'manual_menu' or v_operation.request_payload <> v_payload then
      raise exception 'onboarding_idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_set(v_operation.result, '{outcome}', '"replayed"'::jsonb);
  end if;

  select state.* into v_state
  from public.restaurant_onboarding_states state
  join public.restaurants restaurant on restaurant.id = state.restaurant_id
  where state.restaurant_id = p_restaurant_id and state.owner_user_id = v_owner
    and restaurant.owner_id = v_owner and restaurant.deleted_at is null
  for update of state;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_state.revision <> p_expected_revision then
    v_result := jsonb_build_object('outcome', 'conflict', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  elsif v_state.status <> 'in_progress' or v_state.current_step <> 'menu' then
    raise exception 'onboarding_transition_invalid' using errcode = '22023';
  else
    select coalesce(max(position), -1) + 1 into v_position
    from public.menu_categories
    where restaurant_id = p_restaurant_id and parent_id is null and deleted_at is null;
    insert into public.menu_categories (restaurant_id, name, position, is_visible, vat_rate)
      values (p_restaurant_id, btrim(p_category_name), v_position, true, 10)
      returning * into v_category;
    insert into public.menu_items (
      category_id, name, description, price, is_available, position,
      ingredients, may_contain_allergens, contains_allergens
    ) values (
      v_category.id, btrim(p_item_name), nullif(btrim(coalesce(p_description, '')), ''),
      p_price, true, 0, '[]'::jsonb, '{}', '{}'
    );
    update public.restaurant_onboarding_states
      set status = 'completed', current_step = 'complete',
          completed_steps = array_append(completed_steps, 'menu'), menu_entry_method = 'manual',
          completed_at = clock_timestamp(), revision = revision + 1, updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id;
    v_result := jsonb_build_object('outcome', 'saved', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  end if;
  insert into public.restaurant_onboarding_operations (
    owner_user_id, request_id, restaurant_id, operation, request_payload, result
  ) values (v_owner, p_request_id, p_restaurant_id, 'manual_menu', v_payload, v_result);
  return v_result;
end;
$$;

revoke all on function public.create_onboarding_first_menu_item(uuid,text,text,numeric,text,integer,uuid) from public, anon;
grant execute on function public.create_onboarding_first_menu_item(uuid,text,text,numeric,text,integer,uuid) to authenticated;

create or replace function public.complete_onboarding_csv_menu(
  p_restaurant_id uuid,
  p_expected_revision integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.restaurant_onboarding_states%rowtype;
  v_operation public.restaurant_onboarding_operations%rowtype;
  v_payload jsonb;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null or p_expected_revision < 0 then raise exception 'onboarding_input_invalid' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('restaurantId', p_restaurant_id, 'expectedRevision', p_expected_revision);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_request_id::text, 0));
  select * into v_operation from public.restaurant_onboarding_operations
    where owner_user_id = v_owner and request_id = p_request_id;
  if found then
    if v_operation.operation <> 'csv_menu' or v_operation.request_payload <> v_payload then
      raise exception 'onboarding_idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_set(v_operation.result, '{outcome}', '"replayed"'::jsonb);
  end if;
  select state.* into v_state
  from public.restaurant_onboarding_states state
  join public.restaurants restaurant on restaurant.id = state.restaurant_id
  where state.restaurant_id = p_restaurant_id and state.owner_user_id = v_owner
    and restaurant.owner_id = v_owner and restaurant.deleted_at is null
  for update of state;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_state.revision <> p_expected_revision then
    v_result := jsonb_build_object('outcome', 'conflict', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  elsif not exists (
    select 1 from public.menu_items item
    join public.menu_categories category on category.id = item.category_id
    where category.restaurant_id = p_restaurant_id
      and category.deleted_at is null and item.deleted_at is null
  ) then
    raise exception 'onboarding_menu_empty' using errcode = '22023';
  elsif v_state.status <> 'in_progress' or v_state.current_step <> 'menu' then
    raise exception 'onboarding_transition_invalid' using errcode = '22023';
  else
    update public.restaurant_onboarding_states
      set status = 'completed', current_step = 'complete',
          completed_steps = array_append(completed_steps, 'menu'), menu_entry_method = 'csv',
          completed_at = clock_timestamp(), revision = revision + 1, updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id;
    v_result := jsonb_build_object('outcome', 'saved', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  end if;
  insert into public.restaurant_onboarding_operations (
    owner_user_id, request_id, restaurant_id, operation, request_payload, result
  ) values (v_owner, p_request_id, p_restaurant_id, 'csv_menu', v_payload, v_result);
  return v_result;
end;
$$;

revoke all on function public.complete_onboarding_csv_menu(uuid,integer,uuid) from public, anon;
grant execute on function public.complete_onboarding_csv_menu(uuid,integer,uuid) to authenticated;

create or replace function public.dismiss_restaurant_onboarding_checklist(
  p_restaurant_id uuid,
  p_expected_revision integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.restaurant_onboarding_states%rowtype;
  v_operation public.restaurant_onboarding_operations%rowtype;
  v_payload jsonb;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_request_id is null or p_expected_revision < 0 then raise exception 'onboarding_input_invalid' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('restaurantId', p_restaurant_id, 'expectedRevision', p_expected_revision);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || p_request_id::text, 0));
  select * into v_operation from public.restaurant_onboarding_operations
    where owner_user_id = v_owner and request_id = p_request_id;
  if found then
    if v_operation.operation <> 'dismiss_checklist' or v_operation.request_payload <> v_payload then
      raise exception 'onboarding_idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_set(v_operation.result, '{outcome}', '"replayed"'::jsonb);
  end if;
  select state.* into v_state
  from public.restaurant_onboarding_states state
  join public.restaurants restaurant on restaurant.id = state.restaurant_id
  where state.restaurant_id = p_restaurant_id and state.owner_user_id = v_owner
    and restaurant.owner_id = v_owner and restaurant.deleted_at is null
  for update of state;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_state.revision <> p_expected_revision then
    v_result := jsonb_build_object('outcome', 'conflict', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  elsif v_state.status <> 'completed' then
    raise exception 'onboarding_transition_invalid' using errcode = '22023';
  else
    update public.restaurant_onboarding_states
      set checklist_dismissed_at = clock_timestamp(), revision = revision + 1, updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id;
    v_result := jsonb_build_object('outcome', 'saved', 'snapshot', public.build_restaurant_onboarding_snapshot(p_restaurant_id));
  end if;
  insert into public.restaurant_onboarding_operations (
    owner_user_id, request_id, restaurant_id, operation, request_payload, result
  ) values (v_owner, p_request_id, p_restaurant_id, 'dismiss_checklist', v_payload, v_result);
  return v_result;
end;
$$;

revoke all on function public.dismiss_restaurant_onboarding_checklist(uuid,integer,uuid) from public, anon;
grant execute on function public.dismiss_restaurant_onboarding_checklist(uuid,integer,uuid) to authenticated;
