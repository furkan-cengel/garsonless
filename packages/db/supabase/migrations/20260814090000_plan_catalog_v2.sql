-- Masabu commercial catalogue v2: Starter / Plus / Pro / Business.
-- Prices are canonical in @garsonless/domain; this migration owns persisted
-- vocabulary, providerless trials, billing intervals and Business tenancy.

-- ── Canonical persisted plans ────────────────────────────────────────────────

alter table public.restaurants drop constraint if exists restaurants_plan_check;
update public.restaurants set plan = case plan
  when 'free' then 'starter'
  when 'enterprise' then 'business'
  else plan
end;
alter table public.restaurants alter column plan set default 'starter';
alter table public.restaurants add constraint restaurants_plan_check
  check (plan in ('starter', 'plus', 'pro', 'business'));

-- A small compatibility boundary keeps previously-deployed maintenance RPCs
-- from persisting the retired vocabulary while those functions roll forward.
-- Subscription status remains the authority that locks a lapsed tenant.
create or replace function public.normalize_restaurant_plan_v2()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.plan := case new.plan
    when 'free' then 'starter'
    when 'enterprise' then 'business'
    else new.plan
  end;
  return new;
end;
$$;

drop trigger if exists restaurants_normalize_plan_v2 on public.restaurants;
create trigger restaurants_normalize_plan_v2
before insert or update of plan on public.restaurants
for each row execute function public.normalize_restaurant_plan_v2();

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_plan_check,
  drop constraint if exists billing_subscriptions_scheduled_plan_check,
  drop constraint if exists billing_subscriptions_status_check,
  drop constraint if exists billing_subscriptions_provider_check;
alter table public.billing_subscriptions
  alter column billing_customer_id drop not null,
  alter column provider drop not null,
  add column billing_interval text not null default 'monthly',
  add column intended_plan text;
update public.billing_subscriptions set
  plan = case plan when 'free' then 'starter' when 'enterprise' then 'business' else plan end,
  scheduled_plan = case scheduled_plan when 'free' then 'starter' when 'enterprise' then 'business' else scheduled_plan end;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_plan_check
    check (plan in ('starter', 'plus', 'pro', 'business')),
  add constraint billing_subscriptions_scheduled_plan_check
    check (scheduled_plan is null or scheduled_plan in ('starter', 'plus', 'pro', 'business')),
  add constraint billing_subscriptions_status_check
    check (status in (
      'trial', 'trial_expired', 'active', 'past_due', 'grace_period',
      'suspended', 'cancelled', 'manual_hold'
    )),
  add constraint billing_subscriptions_interval_check
    check (billing_interval in ('monthly', 'annual')),
  add constraint billing_subscriptions_intended_plan_check
    check (intended_plan is null or intended_plan in ('starter', 'plus', 'pro')),
  add constraint billing_subscriptions_provider_check
    check (provider is null or provider = 'iyzico'),
  add constraint billing_subscriptions_local_or_provider_check check (
    (
      provider is null and billing_customer_id is null and provider_subscription_ref is null
      and (
        status in ('trial', 'trial_expired')
        or (plan = 'business' and status in ('active', 'manual_hold', 'cancelled'))
      )
    )
    or (provider = 'iyzico' and billing_customer_id is not null)
  );

alter table public.subscription_invoices
  drop constraint if exists subscription_invoices_plan_check;
alter table public.subscription_invoices
  add column billing_interval text not null default 'monthly';
update public.subscription_invoices set plan = case plan when 'enterprise' then 'pro' else plan end;
alter table public.subscription_invoices
  add constraint subscription_invoices_plan_check check (plan in ('starter', 'plus', 'pro')),
  add constraint subscription_invoices_interval_check check (billing_interval in ('monthly', 'annual'));

alter table public.billing_provider_operations
  drop constraint if exists billing_provider_operations_requested_plan_check;
alter table public.billing_provider_operations
  add column billing_interval text;
update public.billing_provider_operations set
  requested_plan = case requested_plan when 'enterprise' then 'pro' else requested_plan end,
  billing_interval = case when operation_type = 'checkout.initialize' then 'monthly' else null end;
alter table public.billing_provider_operations
  add constraint billing_provider_operations_requested_plan_check
    check (requested_plan is null or requested_plan in ('starter', 'plus', 'pro')),
  add constraint billing_provider_operations_interval_check
    check (
      (operation_type = 'checkout.initialize' and billing_interval in ('monthly', 'annual'))
      or (operation_type <> 'checkout.initialize' and billing_interval is null)
    );

alter table public.tenant_lifecycle_events
  drop constraint if exists tenant_lifecycle_events_from_status_check,
  drop constraint if exists tenant_lifecycle_events_to_status_check;
alter table public.tenant_lifecycle_events
  add constraint tenant_lifecycle_events_from_status_check check (
    from_status is null or from_status in (
      'trial', 'trial_expired', 'active', 'past_due', 'grace_period',
      'suspended', 'cancelled', 'manual_hold'
    )
  ),
  add constraint tenant_lifecycle_events_to_status_check check (
    to_status in (
      'trial', 'trial_expired', 'active', 'past_due', 'grace_period',
      'suspended', 'cancelled', 'manual_hold'
    )
  );

-- Existing development tenants do not receive a fresh trial. They remain
-- recoverable but locked until checkout or a Business sales activation.
insert into public.billing_subscriptions (
  restaurant_id, billing_customer_id, provider, plan, scheduled_plan, status,
  billing_interval, current_period_start, current_period_end, trial_ends_at
)
select r.id, null, null, r.plan, null, 'trial_expired', 'monthly', null, null, clock_timestamp()
from public.restaurants r
where r.deleted_at is null
  and not exists (
    select 1 from public.billing_subscriptions s
    where s.restaurant_id = r.id and s.status <> 'cancelled'
  );

-- ── Business organization foundation ────────────────────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_restaurants (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid not null unique references public.restaurants(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, restaurant_id)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  permissions jsonb not null default '[]'::jsonb check (jsonb_typeof(permissions) = 'array'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx
  on public.organization_members(user_id, organization_id) where status = 'active';

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.update_updated_at();
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function public.update_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_restaurants enable row level security;
alter table public.organization_members enable row level security;
revoke all on public.organizations, public.organization_restaurants, public.organization_members
  from public, anon, authenticated;
grant select, insert, update, delete on public.organizations, public.organization_restaurants, public.organization_members
  to service_role;

-- An accepted restaurant invite becomes shared organization access for a
-- Business workspace. Permission/status edits on that source membership stay
-- synchronized, while pending invites never receive organization access.
create or replace function public.sync_business_organization_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant_id uuid;
  v_user_id uuid;
  v_organization_id uuid;
begin
  if tg_op = 'DELETE' then
    v_restaurant_id := old.restaurant_id;
    v_user_id := old.user_id;
  else
    v_restaurant_id := new.restaurant_id;
    v_user_id := new.user_id;
  end if;
  if v_user_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  select link.organization_id into v_organization_id
  from public.organization_restaurants link
  where link.restaurant_id = v_restaurant_id;
  if v_organization_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op <> 'DELETE' and new.status = 'active' then
    insert into public.organization_members (
      organization_id, user_id, role, permissions, status
    ) values (
      v_organization_id, new.user_id, 'member', new.permissions, 'active'
    )
    on conflict (organization_id, user_id) do update
      set permissions = excluded.permissions, status = 'active', updated_at = clock_timestamp()
      where organization_members.role = 'member';
  else
    update public.organization_members
    set status = 'revoked', updated_at = clock_timestamp()
    where organization_id = v_organization_id and user_id = v_user_id and role = 'member';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists restaurant_members_sync_business_organization on public.restaurant_members;
create trigger restaurant_members_sync_business_organization
after insert or update of user_id, permissions, status or delete on public.restaurant_members
for each row execute function public.sync_business_organization_member();

-- ── Atomic onboarding and subscription-aware entitlement context ─────────────

-- The commercial trial is a product invariant, not an environment-specific
-- tuning value. Keep the shared policy row explicit for existing databases.
update public.billing_platform_policies
set trial_days = 14, updated_at = clock_timestamp()
where id = 'default';

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

  insert into public.restaurants (name, slug, owner_id, plan)
  values (btrim(p_name), p_slug, v_owner, 'pro') returning * into v_restaurant;

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

create or replace function public.read_restaurant_entitlement_context(
  p_restaurant_id uuid,
  p_feature text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.billing_subscriptions%rowtype;
  v_expired public.billing_subscriptions%rowtype;
  v_override jsonb;
  v_access_allowed boolean := false;
begin
  update public.billing_subscriptions
  set status = 'trial_expired', version = version + 1, updated_at = clock_timestamp()
  where restaurant_id = p_restaurant_id
    and status = 'trial'
    and trial_ends_at <= clock_timestamp()
  returning * into v_expired;

  if found then
    insert into public.tenant_lifecycle_events (
      restaurant_id, subscription_id, from_status, to_status, actor_type,
      actor_user_id, reason_code, request_id, occurred_at
    ) values (
      p_restaurant_id, v_expired.id, 'trial', 'trial_expired', 'system',
      null, 'trial_ended_without_payment', 'trial:expired:' || v_expired.id,
      clock_timestamp()
    ) on conflict (request_id) do nothing;
  end if;

  select * into v_subscription
  from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled'
  order by created_at desc limit 1;

  if found then
    v_access_allowed := v_subscription.status in ('active', 'past_due', 'grace_period')
      or (v_subscription.status = 'trial' and v_subscription.trial_ends_at > clock_timestamp());
  end if;

  select public.read_active_tenant_feature_override(p_restaurant_id, p_feature)
  into v_override;

  return jsonb_build_object(
    'accessAllowed', v_access_allowed,
    'subscriptionStatus', case when v_subscription.id is null then null else v_subscription.status end,
    'trialEndsAt', case when v_subscription.id is null then null else v_subscription.trial_ends_at end,
    'override', v_override
  );
end;
$$;

revoke all on function public.read_restaurant_entitlement_context(uuid,text)
  from public, anon, authenticated;
grant execute on function public.read_restaurant_entitlement_context(uuid,text)
  to service_role;

create or replace function public.read_organization_restaurant_access(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'role', member.role,
    'permissions', member.permissions,
    'organizationId', link.organization_id
  )
  from public.organization_restaurants link
  join public.organizations organization on organization.id = link.organization_id and organization.status = 'active'
  join public.organization_members member on member.organization_id = link.organization_id
    and member.user_id = auth.uid() and member.status = 'active'
  where link.restaurant_id = p_restaurant_id;
$$;

create or replace function public.list_organization_restaurant_ids_for_user(p_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select link.restaurant_id
  from public.organization_members member
  join public.organizations organization on organization.id = member.organization_id and organization.status = 'active'
  join public.organization_restaurants link on link.organization_id = member.organization_id
  where member.user_id = p_user_id and member.status = 'active';
$$;

revoke all on function public.read_organization_restaurant_access(uuid)
  from public, anon;
grant execute on function public.read_organization_restaurant_access(uuid)
  to authenticated;
revoke all on function public.list_organization_restaurant_ids_for_user(uuid)
  from public, anon, authenticated;
grant execute on function public.list_organization_restaurant_ids_for_user(uuid)
  to service_role;

-- Business is activated only through the audited superadmin plan command.
-- Repeated activations for restaurants owned by the same user join the same
-- organization, enabling shared access and the branch switcher.
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
  v_organization_id uuid;
begin
  if coalesce(p_plan, '') not in ('starter', 'plus', 'pro', 'business') then
    raise exception 'platform_tenant_plan_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 or p_request_id is null then
    raise exception 'platform_tenant_plan_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity from public.platform_admin_users
  where user_id = p_actor_user_id for update;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role
    or v_identity.role <> 'superadmin' then
    raise exception 'platform_tenant_plan_not_authorized' using errcode = '42501';
  end if;

  select after_state into v_existing_after from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id and request_id = p_request_id
    and action = 'tenant.plan.change' and target_type = 'restaurant'
    and target_id = p_restaurant_id::text;
  if found then return v_existing_after || jsonb_build_object('duplicate', true); end if;

  select * into v_restaurant from public.restaurants
  where id = p_restaurant_id and deleted_at is null for update;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  select * into v_subscription from public.billing_subscriptions
  where restaurant_id = p_restaurant_id and status <> 'cancelled'
  order by created_at desc limit 1 for update;

  v_previous_plan := v_restaurant.plan;
  v_changed := v_previous_plan <> p_plan;

  if p_plan = 'business' then
    if v_subscription.id is not null and v_subscription.provider = 'iyzico' then
      raise exception 'platform_tenant_plan_billing_managed' using errcode = '55000';
    end if;
    if v_subscription.id is null then
      insert into public.billing_subscriptions (
        restaurant_id, billing_customer_id, provider, plan, status, billing_interval
      ) values (p_restaurant_id, null, null, 'business', 'active', 'monthly')
      returning * into v_subscription;
    else
      update public.billing_subscriptions set
        plan = 'business', scheduled_plan = null, intended_plan = null, status = 'active',
        trial_ends_at = null, current_period_start = null,
        current_period_end = null, version = version + 1
      where id = v_subscription.id returning * into v_subscription;
    end if;

    select member.organization_id into v_organization_id
    from public.organization_members member
    where member.user_id = v_restaurant.owner_id and member.role = 'owner' and member.status = 'active'
    order by member.created_at limit 1;
    if v_organization_id is null then
      insert into public.organizations (name, created_by)
      values (v_restaurant.name, v_restaurant.owner_id) returning id into v_organization_id;
      insert into public.organization_members (organization_id, user_id, role)
      values (v_organization_id, v_restaurant.owner_id, 'owner');
    end if;
    insert into public.organization_restaurants (organization_id, restaurant_id)
    values (v_organization_id, p_restaurant_id)
    on conflict (restaurant_id) do nothing;
    insert into public.organization_members (
      organization_id, user_id, role, permissions, status
    )
    select v_organization_id, member.user_id, 'member', member.permissions, 'active'
    from public.restaurant_members member
    where member.restaurant_id = p_restaurant_id
      and member.user_id is not null and member.status = 'active'
    on conflict (organization_id, user_id) do update
      set permissions = excluded.permissions, status = 'active', updated_at = clock_timestamp()
      where organization_members.role = 'member';
  elsif v_subscription.id is not null and v_changed then
    raise exception 'platform_tenant_plan_billing_managed' using errcode = '55000';
  end if;

  if v_changed then
    update public.restaurants set plan = p_plan where id = p_restaurant_id returning * into v_restaurant;
  end if;

  v_after := jsonb_build_object(
    'restaurantId', p_restaurant_id, 'previousPlan', v_previous_plan,
    'plan', p_plan, 'changed', v_changed, 'duplicate', false,
    'requestId', p_request_id, 'organizationId', v_organization_id
  );
  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_actor_user_id, v_identity.role, 'tenant.plan.change', 'restaurant',
    p_restaurant_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object('plan', v_previous_plan, 'subscriptionManaged', v_subscription.id is not null),
    v_after
  );
  return v_after;
end;
$$;

revoke all on function public.set_platform_admin_tenant_plan(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.set_platform_admin_tenant_plan(uuid,uuid,text,text,text,uuid)
  to service_role;

-- Quotas are removed. Feature entitlement is enforced before this atomic insert.
create or replace function public.create_table(
  p_restaurant_id uuid,
  p_label text
)
returns table (outcome text, table_id uuid, token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text := nullif(btrim(p_label), '');
  v_table_id uuid;
  v_token uuid;
begin
  if v_label is null then
    return query select 'invalid_label'::text, null::uuid, null::uuid;
    return;
  end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id and deleted_at is null) then
    return query select 'restaurant_not_found'::text, null::uuid, null::uuid;
    return;
  end if;
  insert into public.tables (restaurant_id, label) values (p_restaurant_id, v_label)
  returning id into v_table_id;
  select q.token into v_token from public.table_qr_tokens q
  where q.restaurant_id = p_restaurant_id and q.table_id = v_table_id and q.revoked_at is null limit 1;
  if v_token is null then raise exception 'table_qr_token_missing' using errcode = 'P0001'; end if;
  return query select 'created'::text, v_table_id, v_token;
exception when unique_violation then
  return query select 'duplicate_label'::text, null::uuid, null::uuid;
end;
$$;

revoke all on function public.create_table(uuid,text) from public, anon, authenticated;
grant execute on function public.create_table(uuid,text) to service_role;

create or replace function public.create_located_table(
  p_restaurant_id uuid,
  p_label text,
  p_floor_label text,
  p_area_label text
)
returns table (outcome text, table_id uuid, token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_floor_label text := nullif(btrim(p_floor_label), '');
  v_area_label text := nullif(btrim(p_area_label), '');
  v_result record;
begin
  if char_length(v_floor_label) > 40 or char_length(v_area_label) > 40 then
    return query select 'invalid_location'::text, null::uuid, null::uuid;
    return;
  end if;

  select created.outcome, created.table_id, created.token into v_result
  from public.create_table(p_restaurant_id, p_label) created;

  if v_result.outcome = 'created' and v_result.table_id is not null then
    update public.tables
    set floor_label = v_floor_label, area_label = v_area_label, updated_at = now()
    where id = v_result.table_id and restaurant_id = p_restaurant_id;
  end if;

  return query select v_result.outcome::text, v_result.table_id::uuid, v_result.token::uuid;
end;
$$;

revoke all on function public.create_located_table(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_located_table(uuid,text,text,text)
  to service_role;

-- Compatibility-only wrappers keep older deployed clients safe during a
-- rolling release. New application code does not use quota-shaped RPCs.
create or replace function public.create_table_with_plan_limit(
  p_restaurant_id uuid,
  p_label text
)
returns table (outcome text, table_id uuid, token uuid, table_limit integer)
language sql
security definer
set search_path = public, pg_temp
as $$
  select created.outcome, created.table_id, created.token, null::integer
  from public.create_table(p_restaurant_id, p_label) created;
$$;

create or replace function public.create_located_table_with_plan_limit(
  p_restaurant_id uuid,
  p_label text,
  p_floor_label text,
  p_area_label text
)
returns table (outcome text, table_id uuid, token uuid, table_limit integer)
language sql
security definer
set search_path = public, pg_temp
as $$
  select created.outcome, created.table_id, created.token, null::integer
  from public.create_located_table(p_restaurant_id, p_label, p_floor_label, p_area_label) created;
$$;

revoke all on function public.create_table_with_plan_limit(uuid,text)
  from public, anon, authenticated;
grant execute on function public.create_table_with_plan_limit(uuid,text)
  to service_role;
revoke all on function public.create_located_table_with_plan_limit(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_located_table_with_plan_limit(uuid,text,text,text)
  to service_role;

-- ── Interval-aware, fail-closed hosted checkout ──────────────────────────────

drop function if exists public.prepare_subscription_checkout_operation(
  uuid,text,text,text,text,text,text,jsonb,jsonb,text,bigint,
  timestamptz,timestamptz,timestamptz,text,text
);

create function public.prepare_subscription_checkout_operation(
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
  p_request_fingerprint text
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
  v_expected_amount bigint;
begin
  v_expected_amount := case p_plan || ':' || p_billing_interval
    when 'starter:monthly' then 34900 when 'starter:annual' then 335040
    when 'plus:monthly' then 69900 when 'plus:annual' then 671040
    when 'pro:monthly' then 119900 when 'pro:annual' then 1151040
    else null
  end;
  if v_expected_amount is null or p_amount_minor <> v_expected_amount
    or p_period_end <= p_period_start
    or char_length(btrim(p_idempotency_key)) not between 1 and 160
    or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'billing_checkout_input_invalid' using errcode = '22023';
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
      or v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'billing_operation_idempotency_conflict' using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'operationId', v_existing.id, 'customerId', v_existing.billing_customer_id,
      'invoiceId', v_existing.id, 'plan', v_existing.requested_plan,
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
    request_fingerprint, status, requested_plan, billing_interval,
    amount_minor, currency, period_start, period_end, due_at
  ) values (
    p_restaurant_id, v_customer.id, 'checkout.initialize', p_idempotency_key,
    p_request_fingerprint, 'processing', p_plan, p_billing_interval,
    p_amount_minor, 'TRY', p_period_start, p_period_end, p_due_at
  ) returning * into v_operation;

  return jsonb_build_object(
    'operationId', v_operation.id, 'customerId', v_customer.id,
    'invoiceId', v_operation.id, 'plan', p_plan, 'interval', p_billing_interval,
    'amountMinor', p_amount_minor, 'currency', 'TRY', 'status', v_operation.status,
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

create or replace function public.find_subscription_checkout_callback(p_provider_checkout_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_expected text;
begin
  select * into v_operation from public.billing_provider_operations
  where provider = 'iyzico' and operation_type = 'checkout.initialize'
    and provider_checkout_ref = btrim(p_provider_checkout_ref);
  if not found then raise exception 'billing_checkout_operation_not_found' using errcode = 'P0002'; end if;
  if v_operation.requested_plan not in ('starter', 'plus', 'pro') then
    raise exception 'billing_checkout_plan_binding_missing' using errcode = 'P0001';
  end if;
  v_expected := v_operation.result_sanitized->>'expectedProviderPlanRef';
  if coalesce(char_length(btrim(v_expected)), 0) not between 1 and 200 then
    raise exception 'billing_checkout_plan_binding_missing' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'operationId', v_operation.id, 'restaurantId', v_operation.restaurant_id,
    'invoiceId', coalesce(v_operation.invoice_id, v_operation.id),
    'requestedPlan', v_operation.requested_plan,
    'expectedProviderPlanRef', v_expected
  );
end;
$$;

create or replace function public.finalize_subscription_checkout_operation(
  p_operation_id uuid,
  p_provider_customer_ref text,
  p_provider_subscription_ref text,
  p_provider_plan_ref text,
  p_provider_invoice_ref text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_invoice public.subscription_invoices%rowtype;
begin
  select * into v_operation from public.billing_provider_operations where id = p_operation_id for update;
  if not found or v_operation.operation_type <> 'checkout.initialize' then
    raise exception 'billing_checkout_operation_not_found' using errcode = 'P0002';
  end if;
  if v_operation.status = 'succeeded' then
    return jsonb_build_object(
      'restaurantId', v_operation.restaurant_id, 'subscriptionId', v_operation.subscription_id,
      'invoiceId', v_operation.invoice_id, 'duplicate', true
    );
  end if;
  if v_operation.status not in ('awaiting_callback', 'requires_reconciliation')
    or p_period_end <= p_period_start then
    raise exception 'billing_checkout_finalize_invalid' using errcode = '22023';
  end if;

  update public.billing_customers set provider_customer_ref = btrim(p_provider_customer_ref)
  where id = v_operation.billing_customer_id and restaurant_id = v_operation.restaurant_id;

  select * into v_subscription from public.billing_subscriptions
  where restaurant_id = v_operation.restaurant_id and status <> 'cancelled'
  order by created_at desc limit 1 for update;
  if found then
    if v_subscription.provider_subscription_ref is not null
      and v_subscription.provider_subscription_ref <> p_provider_subscription_ref then
      raise exception 'billing_live_subscription_conflict' using errcode = 'P0001';
    end if;
    update public.billing_subscriptions set
      billing_customer_id = v_operation.billing_customer_id,
      provider = 'iyzico', provider_subscription_ref = btrim(p_provider_subscription_ref),
      plan = v_operation.requested_plan, scheduled_plan = null, intended_plan = null,
      billing_interval = v_operation.billing_interval, status = 'active',
      current_period_start = p_period_start, current_period_end = p_period_end,
      trial_ends_at = null, version = version + 1
    where id = v_subscription.id returning * into v_subscription;
  else
    insert into public.billing_subscriptions (
      restaurant_id, billing_customer_id, provider, provider_subscription_ref,
      plan, billing_interval, status, current_period_start, current_period_end
    ) values (
      v_operation.restaurant_id, v_operation.billing_customer_id, 'iyzico',
      btrim(p_provider_subscription_ref), v_operation.requested_plan,
      v_operation.billing_interval, 'active', p_period_start, p_period_end
    ) returning * into v_subscription;
  end if;

  update public.restaurants set plan = v_operation.requested_plan where id = v_operation.restaurant_id;

  insert into public.subscription_invoices (
    restaurant_id, subscription_id, provider_invoice_ref, idempotency_key,
    plan, billing_interval, amount_due_minor, status,
    period_start, period_end, due_at, finalized_at
  ) values (
    v_operation.restaurant_id, v_subscription.id, btrim(p_provider_invoice_ref),
    v_operation.idempotency_key || ':invoice', v_operation.requested_plan,
    v_operation.billing_interval, v_operation.amount_minor, 'open',
    p_period_start, p_period_end, v_operation.due_at, clock_timestamp()
  ) on conflict (idempotency_key) do update
    set provider_invoice_ref = excluded.provider_invoice_ref
  returning * into v_invoice;

  update public.billing_provider_operations set
    status = 'succeeded', subscription_id = v_subscription.id, invoice_id = v_invoice.id,
    provider_subscription_ref = btrim(p_provider_subscription_ref),
    result_sanitized = result_sanitized || jsonb_build_object(
      'providerPlanRef', btrim(p_provider_plan_ref),
      'providerInvoiceRef', btrim(p_provider_invoice_ref)
    ), completed_at = clock_timestamp(), last_error = null
  where id = v_operation.id;

  return jsonb_build_object(
    'restaurantId', v_operation.restaurant_id, 'subscriptionId', v_subscription.id,
    'invoiceId', v_invoice.id, 'duplicate', false
  );
end;
$$;

create or replace function public.finalize_subscription_cancellation(
  p_operation_id uuid,
  p_cancelled_at timestamptz,
  p_actor_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.billing_provider_operations%rowtype;
  v_subscription public.billing_subscriptions%rowtype;
  v_from text;
begin
  select * into v_operation from public.billing_provider_operations
  where id = p_operation_id and operation_type = 'subscription.cancel' for update;
  if not found or v_operation.status <> 'succeeded' then
    raise exception 'billing_cancellation_not_completed' using errcode = 'P0002';
  end if;
  select * into v_subscription from public.billing_subscriptions
  where id = v_operation.subscription_id and restaurant_id = v_operation.restaurant_id for update;
  if v_subscription.status = 'cancelled' then
    return jsonb_build_object('subscriptionId', v_subscription.id, 'duplicate', true);
  end if;
  v_from := v_subscription.status;
  update public.billing_subscriptions set
    status = 'cancelled', cancelled_at = p_cancelled_at,
    cancel_at_period_end = false, version = version + 1
  where id = v_subscription.id returning * into v_subscription;
  update public.restaurants set plan = 'starter' where id = v_operation.restaurant_id;
  insert into public.tenant_lifecycle_events (
    restaurant_id, subscription_id, from_status, to_status, actor_type,
    actor_user_id, reason_code, request_id, occurred_at
  ) values (
    v_operation.restaurant_id, v_subscription.id, v_from, 'cancelled',
    'tenant_owner', p_actor_user_id, 'tenant_cancelled', p_request_id, p_cancelled_at
  ) on conflict (request_id) do nothing;
  perform public.enqueue_domain_outbox_event(
    v_operation.restaurant_id, 'billing_subscription', v_subscription.id,
    'subscription.status_changed',
    jsonb_build_object('from', v_from, 'to', 'cancelled', 'reasonCode', 'tenant_cancelled'),
    p_request_id || ':outbox:cancelled'
  );
  return jsonb_build_object('subscriptionId', v_subscription.id, 'duplicate', false);
end;
$$;

revoke all on function public.prepare_subscription_checkout_operation(
  uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,
  timestamptz,timestamptz,timestamptz,text,text
) from public, anon, authenticated;
grant execute on function public.prepare_subscription_checkout_operation(
  uuid,text,text,text,text,text,text,jsonb,jsonb,text,text,bigint,
  timestamptz,timestamptz,timestamptz,text,text
) to service_role;
revoke all on function public.find_subscription_checkout_callback(text)
  from public, anon, authenticated;
grant execute on function public.find_subscription_checkout_callback(text)
  to service_role;
revoke all on function public.finalize_subscription_checkout_operation(uuid,text,text,text,text,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_subscription_checkout_operation(uuid,text,text,text,text,timestamptz,timestamptz)
  to service_role;
revoke all on function public.finalize_subscription_cancellation(uuid,timestamptz,uuid,text)
  from public, anon, authenticated;
grant execute on function public.finalize_subscription_cancellation(uuid,timestamptz,uuid,text)
  to service_role;

-- Keep the platform directory filters aligned with the same closed catalogue.
create or replace function public.list_platform_admin_tenants(
  p_search text default null,
  p_plan text default null,
  p_subscription_status text default null,
  p_lifecycle text default 'active',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_result jsonb;
begin
  if char_length(coalesce(p_search, '')) > 100
    or (p_plan is not null and p_plan not in ('starter', 'plus', 'pro', 'business'))
    or (p_subscription_status is not null and p_subscription_status not in (
      'trial', 'trial_expired', 'active', 'past_due', 'grace_period',
      'suspended', 'cancelled', 'manual_hold', 'none'
    ))
    or p_lifecycle not in ('active', 'deleted', 'all')
    or p_limit not between 1 and 50
    or p_offset not between 0 and 10000
  then
    raise exception 'invalid platform tenant directory input' using errcode = '22023';
  end if;

  with candidates as materialized (
    select r.id, r.name, r.slug, r.plan, r.timezone, r.created_at, r.updated_at, r.deleted_at,
      bs.plan as subscription_plan, bs.status as subscription_status,
      bs.current_period_end, bs.trial_ends_at, bs.grace_ends_at
    from public.restaurants r
    left join lateral (
      select s.plan, s.status, s.current_period_end, s.trial_ends_at, s.grace_ends_at
      from public.billing_subscriptions s
      where s.restaurant_id = r.id
      order by (s.status <> 'cancelled') desc, s.updated_at desc, s.id desc
      limit 1
    ) bs on true
    where (v_search is null or lower(r.name) like '%' || v_search || '%' or lower(r.slug) like '%' || v_search || '%')
      and (p_plan is null or r.plan = p_plan)
      and (
        p_subscription_status is null
        or (p_subscription_status = 'none' and bs.status is null)
        or bs.status = p_subscription_status
      )
      and (
        p_lifecycle = 'all'
        or (p_lifecycle = 'active' and r.deleted_at is null)
        or (p_lifecycle = 'deleted' and r.deleted_at is not null)
      )
  ), paged as (
    select * from candidates
    order by created_at desc, id desc
    limit p_limit offset p_offset
  ), items as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'plan', c.plan,
        'timezone', c.timezone,
        'createdAt', c.created_at,
        'updatedAt', c.updated_at,
        'deletedAt', c.deleted_at,
        'subscription', case when c.subscription_status is null then null else jsonb_build_object(
          'plan', c.subscription_plan,
          'status', c.subscription_status,
          'currentPeriodEnd', c.current_period_end,
          'trialEndsAt', c.trial_ends_at,
          'graceEndsAt', c.grace_ends_at
        ) end,
        'latestInvoice', invoice.invoice,
        'usage', jsonb_build_object(
          'tables', coalesce(usage.table_count, 0),
          'menuItems', coalesce(usage.menu_item_count, 0),
          'teamMembers', coalesce(usage.team_member_count, 0),
          'activeOrders', coalesce(usage.active_order_count, 0),
          'openServiceRequests', coalesce(usage.open_service_request_count, 0)
        ),
        'attention', jsonb_build_object('reconciliationCount', coalesce(usage.reconciliation_count, 0))
      ) order by c.created_at desc, c.id desc
    ), '[]'::jsonb) as value
    from paged c
    left join lateral (
      select jsonb_build_object(
        'id', si.id,
        'status', si.status,
        'amountDueMinor', si.amount_due_minor,
        'amountPaidMinor', si.amount_paid_minor,
        'currency', si.currency,
        'dueAt', si.due_at,
        'paidAt', si.paid_at,
        'failedAt', si.failed_at,
        'createdAt', si.created_at
      ) as invoice
      from public.subscription_invoices si
      where si.restaurant_id = c.id
      order by si.created_at desc, si.id desc
      limit 1
    ) invoice on true
    left join lateral (
      select
        (select count(*) from public.tables t where t.restaurant_id = c.id and t.deleted_at is null) as table_count,
        (select count(*) from public.menu_items mi join public.menu_categories mc on mc.id = mi.category_id
          where mc.restaurant_id = c.id and mc.deleted_at is null and mi.deleted_at is null) as menu_item_count,
        (select count(*) from public.restaurant_members rm where rm.restaurant_id = c.id and rm.status = 'active') as team_member_count,
        (select count(*) from public.orders o where o.restaurant_id = c.id and o.deleted_at is null
          and o.status in ('pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready', 'served')) as active_order_count,
        (select count(*) from public.service_requests sr where sr.restaurant_id = c.id and sr.status = 'pending') as open_service_request_count,
        (select count(*) from public.billing_reconciliation_jobs brj where brj.restaurant_id = c.id
          and brj.status in ('pending', 'running', 'discrepancy', 'failed')) as reconciliation_count
    ) usage on true
  )
  select jsonb_build_object(
    'items', items.value,
    'totalCount', (select count(*) from candidates)
  ) into v_result
  from items;

  return v_result;
end;
$$;

revoke all on function public.list_platform_admin_tenants(text,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.list_platform_admin_tenants(text,text,text,text,integer,integer)
  to service_role;

-- Owner billing projection exposes the selected interval without leaking any
-- provider identifiers or diagnostics.
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
      'billingInterval', v_subscription.billing_interval,
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
      billing_interval as "billingInterval",
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
      from public.billing_provider_operations operation
      where operation.restaurant_id = p_restaurant_id
        and operation.status = 'requires_reconciliation'
        and not exists (
          select 1 from public.billing_reconciliation_jobs job
          where job.dedupe_key = 'provider-operation:' || operation.id
            and job.status in ('pending', 'running', 'discrepancy', 'failed')
        ))
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
