-- Customer identity → Supabase Auth, P1 foundation (pure schema + hook; no
-- providers enabled, no client change, no RLS change).
--
--  * customers.id STAYS the domain anchor — all 6 referencing FKs untouched.
--  * customers.auth_user_id links a row to auth.users on first Supabase login.
--    ON DELETE SET NULL: deleting an auth user must never destroy the loyalty/
--    order history row.
--  * phone becomes nullable: Email/Google/Apple customers have no phone
--    (legacy phone-verified rows keep theirs; UNIQUE stays — Postgres allows
--    multiple NULLs).
--  * email is the dedupe key so an email login and a same-address Google login
--    resolve to ONE customers row (case-insensitive partial unique).
--  * RLS posture UNCHANGED: customers/otp_codes/customer_consents keep ZERO
--    anon/authenticated policies (service-role only). The Supabase session is
--    an identity source (auth.uid()), never a direct table-read grant.

alter table public.customers
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

alter table public.customers alter column phone drop not null;

alter table public.customers add column if not exists email text;

create unique index if not exists customers_email_lower_uniq
  on public.customers (lower(email)) where email is not null;

create index if not exists customers_auth_user_id_idx
  on public.customers (auth_user_id) where auth_user_id is not null;

-- ─── is_staff_user(p_user_id) ────────────────────────────────────────────────
-- Explicit-uid variant of the Team & Roles helpers (is_restaurant_owner /
-- has_restaurant_access read auth.uid() internally — the token hook runs as
-- supabase_auth_admin for a DIFFERENT user, so it must pass the uid in).
-- Staff = owns any restaurant OR has any ACTIVE membership.
create or replace function public.is_staff_user(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.restaurants r
    where r.owner_id = p_user_id and r.deleted_at is null
  ) or exists (
    select 1 from public.restaurant_members m
    where m.user_id = p_user_id and m.status = 'active'
  );
$$;

revoke execute on function public.is_staff_user(uuid) from public;
revoke execute on function public.is_staff_user(uuid) from anon, authenticated;

-- ─── Custom Access Token Hook ────────────────────────────────────────────────
-- Injects a `user_type` claim ('staff' | 'customer') into every issued JWT.
-- Order: an explicit app_metadata.user_type (service-role stamped, user-
-- immutable) wins; otherwise DERIVE from live staff state — so the claim is
-- correct even before the post-signup stamping lands (the documented
-- app_metadata race). Unknown/new users safely default to 'customer'.
--
-- NOT yet registered in Auth settings (dashboard toggle) — registration is a
-- deliberate manual step once Email/Google providers are configured.
create or replace function public.customer_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_catalog
as $$
declare
  claims    jsonb;
  stamped   text;
  user_type text;
begin
  claims  := coalesce(event->'claims', '{}'::jsonb);
  stamped := claims->'app_metadata'->>'user_type';

  if stamped in ('staff', 'customer') then
    user_type := stamped;
  elsif public.is_staff_user((event->>'user_id')::uuid) then
    user_type := 'staff';
  else
    user_type := 'customer';
  end if;

  return jsonb_set(event, '{claims,user_type}', to_jsonb(user_type));
end;
$$;

-- Permissions (Supabase hook discipline): ONLY the auth server may execute;
-- service_role additionally kept for server-side verification tooling (it
-- bypasses RLS anyway and never reaches clients). anon/authenticated: never.
revoke execute on function public.customer_access_token_hook(jsonb) from public;
revoke execute on function public.customer_access_token_hook(jsonb) from anon, authenticated;
grant execute on function public.customer_access_token_hook(jsonb) to supabase_auth_admin;
grant execute on function public.customer_access_token_hook(jsonb) to service_role;
grant usage on schema public to supabase_auth_admin;
