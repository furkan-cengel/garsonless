-- Customer authentication security foundation.
-- Service-role-only intent/rate-limit state plus an atomic role boundary.
-- This migration intentionally contains no provider configuration and sends no OTP.

create table if not exists public.customer_auth_intents (
  nonce_hash text primary key,
  flow text not null check (flow in ('email', 'oauth')),
  context_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_auth_intents_nonce_hash_shape check (nonce_hash ~ '^[0-9a-f]{64}$'),
  constraint customer_auth_intents_context_hash_shape check (context_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists customer_auth_intents_expiry_idx
  on public.customer_auth_intents (expires_at)
  where consumed_at is null;

alter table public.customer_auth_intents enable row level security;
alter table public.customer_auth_intents force row level security;
revoke all on table public.customer_auth_intents from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_auth_intents to service_role;

create table if not exists public.customer_auth_rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  hits integer not null check (hits > 0),
  expires_at timestamptz not null,
  primary key (bucket, subject_hash),
  constraint customer_auth_rate_limits_subject_hash_shape check (subject_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists customer_auth_rate_limits_expiry_idx
  on public.customer_auth_rate_limits (expires_at);

alter table public.customer_auth_rate_limits enable row level security;
alter table public.customer_auth_rate_limits force row level security;
revoke all on table public.customer_auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_auth_rate_limits to service_role;

create or replace function public.register_customer_auth_intent(
  p_nonce_hash text,
  p_flow text,
  p_context_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_nonce_hash !~ '^[0-9a-f]{64}$'
    or p_context_hash !~ '^[0-9a-f]{64}$'
    or p_flow not in ('email', 'oauth')
    or p_expires_at <= now()
    or p_expires_at > now() + interval '11 minutes' then
    raise exception 'invalid customer auth intent' using errcode = '22023';
  end if;

  insert into public.customer_auth_intents (nonce_hash, flow, context_hash, expires_at)
  values (p_nonce_hash, p_flow, p_context_hash, p_expires_at)
  on conflict (nonce_hash) do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.consume_customer_auth_intent(
  p_nonce_hash text,
  p_context_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.customer_auth_intents intent
  set consumed_at = now()
  where intent.nonce_hash = p_nonce_hash
    and intent.context_hash = p_context_hash
    and intent.consumed_at is null
    and intent.expires_at > now();
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.consume_customer_auth_rate_limit(
  p_bucket text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hits integer;
  v_expires_at timestamptz;
begin
  if length(p_bucket) not between 1 and 80
    or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid customer auth rate limit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('customer-auth-rate:' || p_bucket || ':' || p_subject_hash, 0));

  select rate.hits, rate.expires_at
  into v_hits, v_expires_at
  from public.customer_auth_rate_limits rate
  where rate.bucket = p_bucket and rate.subject_hash = p_subject_hash
  for update;

  if not found or v_expires_at <= v_now then
    v_hits := 1;
    v_expires_at := v_now + make_interval(secs => p_window_seconds);
    insert into public.customer_auth_rate_limits as rate (
      bucket, subject_hash, window_started_at, hits, expires_at
    ) values (
      p_bucket, p_subject_hash, v_now, v_hits, v_expires_at
    ) on conflict (bucket, subject_hash) do update set
      window_started_at = excluded.window_started_at,
      hits = excluded.hits,
      expires_at = excluded.expires_at;
  else
    update public.customer_auth_rate_limits rate
    set hits = rate.hits + 1
    where rate.bucket = p_bucket and rate.subject_hash = p_subject_hash
    returning rate.hits into v_hits;
  end if;

  return query select
    v_hits <= p_limit,
    greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer);
end;
$$;

revoke all on function public.register_customer_auth_intent(text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.consume_customer_auth_intent(text, text)
  from public, anon, authenticated;
revoke all on function public.consume_customer_auth_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.register_customer_auth_intent(text, text, text, timestamptz)
  to service_role;
grant execute on function public.consume_customer_auth_intent(text, text)
  to service_role;
grant execute on function public.consume_customer_auth_rate_limit(text, text, integer, integer)
  to service_role;

-- Live staff/platform state always wins over a stale customer stamp.
create or replace function public.is_staff_or_platform_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.is_staff_user(p_user_id) or exists (
    select 1
    from public.platform_admin_users platform_user
    where platform_user.user_id = p_user_id
      and platform_user.status <> 'revoked'
  );
$$;

revoke all on function public.is_staff_or_platform_user(uuid) from public, anon, authenticated;
grant execute on function public.is_staff_or_platform_user(uuid) to service_role, supabase_auth_admin;

create or replace function public.customer_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  stamped text := claims->'app_metadata'->>'user_type';
  user_type text;
begin
  if public.is_staff_or_platform_user((event->>'user_id')::uuid) then
    user_type := 'staff';
  elsif stamped = 'staff' then
    user_type := 'staff';
  else
    user_type := 'customer';
  end if;

  return jsonb_set(event, '{claims,user_type}', to_jsonb(user_type));
end;
$$;

revoke all on function public.customer_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.customer_access_token_hook(jsonb) to supabase_auth_admin, service_role;

create or replace function public.lock_customer_identity_role(p_user_id uuid)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  select pg_advisory_xact_lock(hashtextextended('customer-identity-role:' || p_user_id::text, 0));
$$;

revoke all on function public.lock_customer_identity_role(uuid) from public, anon, authenticated;

create or replace function public.assert_customer_identity_role_available(
  p_user_id uuid,
  p_target_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_user_id is null or p_target_role not in ('customer', 'staff') then
    return;
  end if;
  perform public.lock_customer_identity_role(p_user_id);

  if p_target_role = 'customer' and public.is_staff_or_platform_user(p_user_id) then
    raise exception 'staff or platform identity cannot be linked as customer' using errcode = 'GL003';
  end if;

  if p_target_role = 'staff' and exists (
    select 1 from public.customers customer
    where customer.auth_user_id = p_user_id
      and customer.merged_into_customer_id is null
  ) then
    raise exception 'customer identity cannot be linked as staff or platform user' using errcode = 'GL003';
  end if;
end;
$$;

revoke all on function public.assert_customer_identity_role_available(uuid, text)
  from public, anon, authenticated;

create or replace function public.guard_customer_identity_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.auth_user_id is not null and new.merged_into_customer_id is null then
    perform public.assert_customer_identity_role_available(new.auth_user_id, 'customer');
  end if;
  return new;
end;
$$;

create or replace function public.guard_staff_identity_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid;
begin
  if tg_table_name = 'restaurants' then
    if new.deleted_at is not null then return new; end if;
    v_user_id := new.owner_id;
  elsif tg_table_name = 'restaurant_members' then
    if new.status <> 'active' then return new; end if;
    v_user_id := new.user_id;
  elsif tg_table_name = 'platform_admin_users' then
    if new.status = 'revoked' then return new; end if;
    v_user_id := new.user_id;
  end if;

  perform public.assert_customer_identity_role_available(v_user_id, 'staff');
  return new;
end;
$$;

revoke all on function public.guard_customer_identity_role() from public, anon, authenticated;
revoke all on function public.guard_staff_identity_role() from public, anon, authenticated;

drop trigger if exists customers_identity_role_guard on public.customers;
create trigger customers_identity_role_guard
before insert or update of auth_user_id, merged_into_customer_id on public.customers
for each row execute function public.guard_customer_identity_role();

drop trigger if exists restaurants_identity_role_guard on public.restaurants;
create trigger restaurants_identity_role_guard
before insert or update of owner_id, deleted_at on public.restaurants
for each row execute function public.guard_staff_identity_role();

drop trigger if exists restaurant_members_identity_role_guard on public.restaurant_members;
create trigger restaurant_members_identity_role_guard
before insert or update of user_id, status on public.restaurant_members
for each row execute function public.guard_staff_identity_role();

drop trigger if exists platform_admin_users_identity_role_guard on public.platform_admin_users;
create trigger platform_admin_users_identity_role_guard
before insert or update of user_id, status on public.platform_admin_users
for each row execute function public.guard_staff_identity_role();

-- Fail before installing the boundary if historical overlap requires manual review.
do $$
begin
  if exists (
    select 1
    from public.customers customer
    where customer.auth_user_id is not null
      and customer.merged_into_customer_id is null
      and public.is_staff_or_platform_user(customer.auth_user_id)
  ) then
    raise exception 'existing customer/staff identity overlap requires manual remediation'
      using errcode = 'GL003';
  end if;
end;
$$;
