-- Customers phase 2: birthdays and automatic point rewards.
--
-- Birthdays (day and month, never a year) live on the customer's link to one
-- restaurant, so one venue never sees or changes what a customer told another.
-- The customer sets it from the QR menu; the owner may set it from the profile.
--
-- Four rules per restaurant, all paid in loyalty points:
--   birthday  once a year, on the day or a few days before it
--   visit     every Nth visit (a visit is a bill), counted from when the rule
--             was switched on, so enabling it never back-pays old milestones
--   spend     each collected bill at or above a minimum, paid after switch-on
--   winback   once per long absence that began after switch-on
-- apply_customer_rewards() runs every 10 minutes; a grant row keyed by
-- (restaurant, customer, rule, period) makes every run idempotent.

alter table public.customer_restaurants
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day smallint check (birth_day between 1 and 31),
  add column birthday_source text check (birthday_source in ('customer', 'owner')),
  add column birthday_updated_at timestamptz,
  add constraint customer_restaurants_birthday_pair check ((birth_month is null) = (birth_day is null));

create table public.customer_reward_rules (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null check (kind in ('birthday', 'visit', 'spend', 'winback')),
  enabled boolean not null default false,
  points integer not null check (points between 1 and 100000),
  params jsonb not null default '{}',
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (restaurant_id, kind)
);
alter table public.customer_reward_rules enable row level security;
revoke all on table public.customer_reward_rules from public, anon, authenticated;
grant all on table public.customer_reward_rules to service_role;

create table public.customer_reward_grants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('birthday', 'visit', 'spend', 'winback')),
  period_key text not null check (char_length(period_key) between 1 and 80),
  points integer not null check (points > 0),
  -- No foreign key: tenant erasure deletes ledger rows and must not be blocked.
  loyalty_transaction_id uuid,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (restaurant_id, customer_id, kind, period_key)
);
create index customer_reward_grants_customer on public.customer_reward_grants(restaurant_id, customer_id, created_at desc);
alter table public.customer_reward_grants enable row level security;
revoke all on table public.customer_reward_grants from public, anon, authenticated;
grant all on table public.customer_reward_grants to service_role;

-- Rewards follow the loyalty entitlement: the plan check, a platform override,
-- and the restaurant's own points switch.
create or replace function public.customer_rewards_allowed(p_restaurant uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (r.settings -> 'loyalty' ->> 'points_enabled')::boolean from public.restaurants r where r.id = p_restaurant and r.deleted_at is null), false)
    and case (public.read_active_tenant_feature_override(p_restaurant, 'loyalty') ->> 'decision')
      when 'deny' then false
      when 'allow' then true
      else public.inventory_allowed(p_restaurant)
    end;
$$;

create or replace function public.customer_reward_scope(p_restaurant uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select case when r.settings -> 'loyalty' ->> 'scope' = 'network' then '00000000-0000-0000-0000-000000000000'::uuid else r.id end
  from public.restaurants r where r.id = p_restaurant;
$$;

-- Grants once per period; returns true when this call wrote the points.
create or replace function public.grant_customer_reward(p_restaurant uuid, p_customer uuid, p_kind text, p_period text, p_points integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare grant_id uuid; tx uuid; scope uuid := public.customer_reward_scope(p_restaurant);
begin
  insert into public.customer_reward_grants (restaurant_id, customer_id, kind, period_key, points)
  values (p_restaurant, p_customer, p_kind, p_period, p_points)
  on conflict (restaurant_id, customer_id, kind, period_key) do nothing
  returning id into grant_id;
  if grant_id is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(p_customer::text || ':' || scope::text));
  insert into public.loyalty_transactions (customer_id, restaurant_id, scope_key, type, delta, direction, reason)
  values (p_customer, p_restaurant, scope, 'points', p_points, 'earn', 'reward:' || p_kind)
  returning id into tx;
  update public.customer_reward_grants set loyalty_transaction_id = tx where id = grant_id;
  return true;
end $$;

create or replace function public.apply_customer_rewards()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  rule public.customer_reward_rules;
  zone text;
  today date;
  granted integer := 0;
  candidate record;
  every integer;
begin
  -- One run at a time; a slow run makes the next one skip rather than double up.
  if not pg_try_advisory_xact_lock(hashtextextended('customer-rewards-run', 0)) then return 0; end if;
  for rule in select * from public.customer_reward_rules where enabled and enabled_at is not null loop
    if not public.customer_rewards_allowed(rule.restaurant_id) then continue; end if;
    select coalesce(nullif(r.timezone, ''), 'Europe/Istanbul') into zone from public.restaurants r where r.id = rule.restaurant_id;
    today := (now() at time zone zone)::date;

    if rule.kind = 'birthday' then
      for candidate in
        select cr.customer_id, next_day
        from public.customer_restaurants cr
        cross join lateral (
          select case when this_year >= today then this_year else public.customer_birthday_date(extract(year from today)::int + 1, cr.birth_month, cr.birth_day) end as next_day
          from (select public.customer_birthday_date(extract(year from today)::int, cr.birth_month, cr.birth_day) as this_year) y
        ) d
        where cr.restaurant_id = rule.restaurant_id and cr.birth_month is not null
          and next_day - today between 0 and coalesce((rule.params ->> 'leadDays')::int, 0)
      loop
        if public.grant_customer_reward(rule.restaurant_id, candidate.customer_id, 'birthday', extract(year from candidate.next_day)::text, rule.points) then granted := granted + 1; end if;
      end loop;

    elsif rule.kind = 'visit' then
      every := greatest(2, coalesce((rule.params ->> 'every')::int, 10));
      for candidate in
        select o.customer_id,
          count(distinct coalesce(o.table_session_id, o.id)) as visits_now,
          count(distinct coalesce(o.table_session_id, o.id)) filter (where o.created_at < rule.enabled_at) as visits_before
        from public.orders o
        where o.restaurant_id = rule.restaurant_id and o.customer_id is not null and o.deleted_at is null and o.status::text <> 'cancelled'
          and o.customer_id in (select x.customer_id from public.orders x where x.restaurant_id = rule.restaurant_id and x.customer_id is not null and x.created_at > now() - interval '2 days')
        group by o.customer_id
      loop
        if candidate.visits_now / every > candidate.visits_before / every then
          if public.grant_customer_reward(rule.restaurant_id, candidate.customer_id, 'visit', ((candidate.visits_now / every) * every)::text, rule.points) then granted := granted + 1; end if;
        end if;
      end loop;

    elsif rule.kind = 'spend' then
      for candidate in
        select o.customer_id, o.id
        from public.orders o
        where o.restaurant_id = rule.restaurant_id and o.customer_id is not null and o.deleted_at is null
          and o.paid_at >= greatest(rule.enabled_at, now() - interval '2 days')
          and o.status::text <> 'cancelled' and o.payment_method is distinct from 'comp'
          and o.total >= coalesce((rule.params ->> 'minimum')::numeric, 1000)
      loop
        if public.grant_customer_reward(rule.restaurant_id, candidate.customer_id, 'spend', candidate.id::text, rule.points) then granted := granted + 1; end if;
      end loop;

    elsif rule.kind = 'winback' then
      for candidate in
        select o.customer_id, max(o.created_at) as last_visit
        from public.orders o
        where o.restaurant_id = rule.restaurant_id and o.customer_id is not null and o.deleted_at is null and o.status::text <> 'cancelled'
        group by o.customer_id
        having max(o.created_at) <= now() - make_interval(days => coalesce((rule.params ->> 'inactiveDays')::int, 60))
          and max(o.created_at) + make_interval(days => coalesce((rule.params ->> 'inactiveDays')::int, 60)) >= rule.enabled_at
      loop
        if public.grant_customer_reward(rule.restaurant_id, candidate.customer_id, 'winback', (candidate.last_visit at time zone zone)::date::text, rule.points) then granted := granted + 1; end if;
      end loop;
    end if;
  end loop;
  return granted;
end $$;

-- 29 February falls on 28 February in other years.
create or replace function public.customer_birthday_date(p_year integer, p_month integer, p_day integer)
returns date language sql immutable set search_path = public, pg_temp as $$
  select make_date(p_year, p_month, least(p_day, extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int));
$$;

-- How many customers a rule would reach now, for the settings screen.
create or replace function public.customer_reward_preview(p_restaurant uuid, p_kind text, p_params jsonb)
returns integer language plpgsql stable security definer set search_path = public, pg_temp as $$
declare zone text; today date; every integer; result integer;
begin
  select coalesce(nullif(r.timezone, ''), 'Europe/Istanbul') into zone from public.restaurants r where r.id = p_restaurant;
  today := (now() at time zone zone)::date;
  if p_kind = 'birthday' then
    select count(*) into result from public.customer_restaurants cr
    where cr.restaurant_id = p_restaurant and cr.birth_month is not null
      and (case when public.customer_birthday_date(extract(year from today)::int, cr.birth_month, cr.birth_day) >= today
            then public.customer_birthday_date(extract(year from today)::int, cr.birth_month, cr.birth_day)
            else public.customer_birthday_date(extract(year from today)::int + 1, cr.birth_month, cr.birth_day) end) - today between 0 and 7;
  elsif p_kind = 'visit' then
    every := greatest(2, coalesce((p_params ->> 'every')::int, 10));
    select count(*) into result from (
      select count(distinct coalesce(o.table_session_id, o.id)) as visits from public.orders o
      where o.restaurant_id = p_restaurant and o.customer_id is not null and o.deleted_at is null and o.status::text <> 'cancelled'
      group by o.customer_id) v where v.visits % every = every - 1;
  elsif p_kind = 'spend' then
    select count(distinct o.customer_id) into result from public.orders o
    where o.restaurant_id = p_restaurant and o.customer_id is not null and o.deleted_at is null and o.paid_at > now() - interval '30 days'
      and o.status::text <> 'cancelled' and o.payment_method is distinct from 'comp' and o.total >= coalesce((p_params ->> 'minimum')::numeric, 1000);
  elsif p_kind = 'winback' then
    select count(*) into result from (
      select max(o.created_at) as last_visit from public.orders o
      where o.restaurant_id = p_restaurant and o.customer_id is not null and o.deleted_at is null and o.status::text <> 'cancelled'
      group by o.customer_id) v where v.last_visit <= now() - make_interval(days => coalesce((p_params ->> 'inactiveDays')::int, 60));
  else
    raise exception 'invalid_input';
  end if;
  return coalesce(result, 0);
end $$;

-- Owner-only; the dashboard action checks first and the RPC checks again.
create or replace function public.save_customer_reward_rule(p_restaurant uuid, p_actor uuid, p_kind text, p_enabled boolean, p_points integer, p_params jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare saved public.customer_reward_rules;
begin
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant and r.owner_id = p_actor and r.deleted_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind not in ('birthday', 'visit', 'spend', 'winback') or p_points is null or p_points not between 1 and 100000 or jsonb_typeof(p_params) <> 'object'
     or (p_kind = 'birthday' and coalesce((p_params ->> 'leadDays')::int, -1) not in (0, 3, 7))
     or (p_kind = 'visit' and coalesce((p_params ->> 'every')::int, -1) not between 2 and 100)
     or (p_kind = 'spend' and coalesce((p_params ->> 'minimum')::numeric, -1) not between 1 and 1000000)
     or (p_kind = 'winback' and coalesce((p_params ->> 'inactiveDays')::int, -1) not between 14 and 365) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.customer_reward_rules as rule (restaurant_id, kind, enabled, points, params, enabled_at, updated_at, updated_by)
  values (p_restaurant, p_kind, p_enabled, p_points, p_params, case when p_enabled then now() end, now(), p_actor)
  on conflict (restaurant_id, kind) do update set
    enabled = excluded.enabled, points = excluded.points, params = excluded.params, updated_at = now(), updated_by = excluded.updated_by,
    -- Switching a rule on starts its count now; editing an active rule keeps the original start.
    enabled_at = case when excluded.enabled and not rule.enabled then now() when excluded.enabled then rule.enabled_at end
  returning * into saved;
  return jsonb_build_object('kind', saved.kind, 'enabled', saved.enabled, 'points', saved.points, 'params', saved.params, 'enabledAt', saved.enabled_at);
end $$;

-- Sets or clears a birthday on one customer's link to one restaurant.
create or replace function public.set_customer_birthday(p_restaurant uuid, p_customer uuid, p_month integer, p_day integer, p_source text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_source not in ('customer', 'owner') or (p_month is null) <> (p_day is null)
     or (p_month is not null and (p_month not between 1 and 12 or p_day < 1 or p_day > extract(day from (make_date(2024, p_month, 1) + interval '1 month - 1 day')))) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.customer_restaurants set birth_month = p_month, birth_day = p_day,
    birthday_source = case when p_month is null then null else p_source end, birthday_updated_at = now()
  where restaurant_id = p_restaurant and customer_id = p_customer;
  return found;
end $$;

-- What the QR menu shows a signed-in customer: rewards from the last two weeks not yet seen.
create or replace function public.customer_reward_notices(p_restaurant uuid, p_customer uuid, p_mark_seen boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'kind', g.kind, 'points', g.points, 'createdAt', g.created_at) order by g.created_at desc), '[]')
  into result from public.customer_reward_grants g
  where g.restaurant_id = p_restaurant and g.customer_id = p_customer and g.seen_at is null and g.created_at > now() - interval '14 days';
  if p_mark_seen then
    update public.customer_reward_grants set seen_at = now()
    where restaurant_id = p_restaurant and customer_id = p_customer and seen_at is null;
  end if;
  return result;
end $$;

revoke all on function public.customer_rewards_allowed(uuid), public.customer_reward_scope(uuid),
  public.grant_customer_reward(uuid, uuid, text, text, integer), public.apply_customer_rewards(),
  public.customer_reward_preview(uuid, text, jsonb), public.save_customer_reward_rule(uuid, uuid, text, boolean, integer, jsonb),
  public.set_customer_birthday(uuid, uuid, integer, integer, text), public.customer_reward_notices(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.customer_rewards_allowed(uuid), public.apply_customer_rewards(),
  public.customer_reward_preview(uuid, text, jsonb), public.save_customer_reward_rule(uuid, uuid, text, boolean, integer, jsonb),
  public.set_customer_birthday(uuid, uuid, integer, integer, text), public.customer_reward_notices(uuid, uuid, boolean)
  to service_role;

select cron.schedule('customer-rewards-every-10-minutes', '*/10 * * * *', 'select public.apply_customer_rewards();');

-- Tenant privacy erasure also removes reward rules and grants. Birthdays go with
-- customer_restaurants, which it already deletes. Body otherwise as 20261027120100.
create or replace function public.erase_platform_admin_tenant_privacy_data(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
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
  v_operation public.platform_tenant_privacy_operations%rowtype;
  v_customer_ids uuid[] := '{}'::uuid[];
  v_summary jsonb;
  v_customer_count integer := 0;
  v_consent_count integer := 0;
  v_order_count integer := 0;
  v_loyalty_count integer := 0;
  v_campaign_count integer := 0;
  v_share_count integer := 0;
  v_anonymized_count integer := 0;
  v_note_count integer := 0;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 or p_request_id is null then
    raise exception 'platform_privacy_input_invalid' using errcode = '22023';
  end if;
  select * into v_identity from public.platform_admin_users where user_id = p_actor_user_id for update;
  if not found or v_identity.status <> 'active' or v_identity.role <> p_actor_role or v_identity.role <> 'superadmin' then
    raise exception 'platform_privacy_not_authorized' using errcode = '42501';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id and deleted_at is null for update;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  select * into v_operation from public.platform_tenant_privacy_operations where request_id = p_request_id;
  if found then
    if v_operation.restaurant_id <> p_restaurant_id or v_operation.operation_type <> 'erase' or v_operation.requested_by <> p_actor_user_id then
      raise exception 'platform_privacy_request_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at), 'duplicate', true);
  end if;

  select coalesce(array_agg(customer_id), '{}'::uuid[]), count(*) into v_customer_ids, v_customer_count
  from (
    select customer_id from public.customer_restaurants where restaurant_id = p_restaurant_id
    union select customer_id from public.orders where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.loyalty_transactions where restaurant_id = p_restaurant_id
    union select customer_id from public.customer_consents where restaurant_id = p_restaurant_id
    union select customer_id from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.campaign_recipients where restaurant_id = p_restaurant_id
    union select customer_id from public.message_events where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.customer_notes where restaurant_id = p_restaurant_id
  ) ids;

  select count(*) into v_consent_count from public.customer_consents where restaurant_id = p_restaurant_id;
  select count(*) into v_order_count from public.orders where restaurant_id = p_restaurant_id and customer_id is not null;
  select count(*) into v_loyalty_count from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  select count(*) into v_campaign_count from public.campaign_recipients where restaurant_id = p_restaurant_id;
  select count(*) into v_share_count from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null;
  select count(*) into v_note_count from public.customer_notes where restaurant_id = p_restaurant_id;

  update public.orders set customer_id = null, customer_tier = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.payment_shares set customer_id = null, label = null where restaurant_id = p_restaurant_id and customer_id is not null;
  update public.message_events set customer_id = null, recipient_id = null, phone = null, provider_message_id = null, error = null, metadata = '{}'::jsonb where restaurant_id = p_restaurant_id and customer_id is not null;
  delete from public.campaign_recipients where restaurant_id = p_restaurant_id;
  delete from public.customer_consents where restaurant_id = p_restaurant_id;
  delete from public.customer_notes where restaurant_id = p_restaurant_id;
  delete from public.customer_reward_grants where restaurant_id = p_restaurant_id;
  delete from public.customer_reward_rules where restaurant_id = p_restaurant_id;
  delete from public.customer_contact_reveals where restaurant_id = p_restaurant_id;
  -- Manual credit requests and their ledger rows reference each other; unlink before deleting both.
  update public.manual_store_credit_requests set loyalty_transaction_id = null where restaurant_id = p_restaurant_id;
  delete from public.loyalty_transactions where restaurant_id = p_restaurant_id;
  delete from public.manual_store_credit_requests where restaurant_id = p_restaurant_id;
  delete from public.manual_point_deduction_requests where restaurant_id = p_restaurant_id;
  delete from public.customer_restaurants where restaurant_id = p_restaurant_id;

  update public.customers customer set name = null, phone = null, email = null, auth_user_id = null, verified_at = null
  where customer.id = any(v_customer_ids)
    and not exists (select 1 from public.customer_restaurants x where x.customer_id = customer.id)
    and not exists (select 1 from public.orders x where x.customer_id = customer.id)
    and not exists (select 1 from public.loyalty_transactions x where x.customer_id = customer.id)
    and not exists (select 1 from public.customer_consents x where x.customer_id = customer.id)
    and not exists (select 1 from public.payment_shares x where x.customer_id = customer.id)
    and not exists (select 1 from public.campaign_recipients x where x.customer_id = customer.id)
    and not exists (select 1 from public.message_events x where x.customer_id = customer.id)
    and not exists (select 1 from public.customer_notes x where x.customer_id = customer.id);
  get diagnostics v_anonymized_count = row_count;

  v_summary := jsonb_build_object('customerCount', v_customer_count, 'consentCount', v_consent_count, 'orderLinkCount', v_order_count, 'loyaltyRowCount', v_loyalty_count, 'campaignRecipientCount', v_campaign_count, 'paymentShareLinkCount', v_share_count, 'customerNoteCount', v_note_count, 'anonymizedGlobalCustomerCount', v_anonymized_count);
  insert into public.platform_tenant_privacy_operations (restaurant_id, operation_type, status, reason, result_summary, requested_by, request_id)
  values (p_restaurant_id, 'erase', 'completed', btrim(p_reason), v_summary, p_actor_user_id, p_request_id)
  returning * into v_operation;
  insert into public.platform_admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values (p_actor_user_id, v_identity.role, 'tenant.privacy.erase', 'restaurant', p_restaurant_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object('customerCount', v_customer_count), jsonb_build_object('operationId', v_operation.id, 'summary', v_summary, 'billingRecordsPreserved', true, 'operationalOrdersPreserved', true));

  return jsonb_build_object('operation', jsonb_build_object('id', v_operation.id, 'restaurantId', v_operation.restaurant_id, 'type', v_operation.operation_type, 'status', v_operation.status, 'reason', v_operation.reason, 'summary', v_operation.result_summary, 'requestedBy', v_operation.requested_by, 'requestId', v_operation.request_id, 'createdAt', v_operation.created_at, 'completedAt', v_operation.completed_at), 'duplicate', false);
end;
$$;

revoke all on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.erase_platform_admin_tenant_privacy_data(uuid,uuid,text,text,uuid) to service_role;

