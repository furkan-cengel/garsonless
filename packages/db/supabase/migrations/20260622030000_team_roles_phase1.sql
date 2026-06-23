-- ============================================================================
-- Team & Roles — Phase 1: membership foundation + authorization rewrite (RLS)
-- ============================================================================
-- Owner stays the source of truth (restaurants.owner_id) and is implicit
-- all-perms — NO seeded owner member row. Non-owner staff get a
-- restaurant_members row with a section permission list. Authorization moves
-- from "owner_id = auth.uid()" to membership-aware helpers, WITHOUT relying on
-- the broad anon_read_restaurants policy for the gate (see lib/auth/access.ts).
--
-- Two-tier RLS (locked with product owner):
--   * OPERATIONAL tables (orders, tables, sessions, menu, theme, service_reqs):
--       SELECT = any active member (coarse) ; WRITE = matching section.
--   * SENSITIVE tables (loyalty ledger, customer_segments, campaigns):
--       gated to the 'customers' section. payment_credentials / kitchen_credentials
--       stay OWNER-ONLY (untouched). customers/consents remain service-role only.
--
-- Backward compatibility: with ZERO member rows every helper collapses to the
-- owner check, so owner behavior is byte-identical to before this migration.

-- ── 1. restaurant_members ───────────────────────────────────────────────────

create table public.restaurant_members (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,   -- null until invite accepted
  email           text not null,
  permissions     jsonb not null default '[]'::jsonb,                 -- array of section keys
  status          text not null default 'invited' check (status in ('invited','active','disabled')),
  invited_by      uuid references auth.users(id),
  invited_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  invite_token_hash text,
  invite_expires_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- one active membership per (restaurant,user); one open invite per (restaurant,email)
create unique index restaurant_members_user_uniq
  on public.restaurant_members(restaurant_id, user_id) where user_id is not null;
create unique index restaurant_members_email_uniq
  on public.restaurant_members(restaurant_id, lower(email)) where status <> 'disabled';
create index restaurant_members_user_idx
  on public.restaurant_members(user_id) where user_id is not null;
create index restaurant_members_restaurant_idx
  on public.restaurant_members(restaurant_id);

create trigger restaurant_members_updated_at
  before update on public.restaurant_members
  for each row execute function public.update_updated_at();

alter table public.restaurant_members enable row level security;

-- ── 2. authorization helpers (SECURITY DEFINER → no recursion into members RLS)

create or replace function public.is_restaurant_owner(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.owner_id = auth.uid() and r.deleted_at is null
  );
$$;

create or replace function public.has_restaurant_access(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_catalog as $$
  select public.is_restaurant_owner(p_restaurant_id)
    or exists (
      select 1 from public.restaurant_members m
      where m.restaurant_id = p_restaurant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    );
$$;

create or replace function public.has_restaurant_section(p_restaurant_id uuid, p_section text)
returns boolean language sql stable security definer set search_path = public, pg_catalog as $$
  select public.is_restaurant_owner(p_restaurant_id)
    or exists (
      select 1 from public.restaurant_members m
      where m.restaurant_id = p_restaurant_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.permissions ? p_section
    );
$$;

-- menu_items has no restaurant_id (linked via category) → resolver bypasses RLS
create or replace function public.menu_category_restaurant(p_category_id uuid)
returns uuid language sql stable security definer set search_path = public, pg_catalog as $$
  select restaurant_id from public.menu_categories where id = p_category_id;
$$;

-- ── 3. restaurant_members RLS (member reads own; owner manages all) ──────────

create policy "member_reads_own_membership" on public.restaurant_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_restaurant_owner(restaurant_id));

create policy "owner_manages_members" on public.restaurant_members
  for all to authenticated
  using (public.is_restaurant_owner(restaurant_id))
  with check (public.is_restaurant_owner(restaurant_id));

-- ── 4. OPERATIONAL tables: coarse SELECT (any active member) + section WRITE ─

-- tables  (section 'tables')
drop policy if exists "owner_manage_tables" on public.tables;
create policy "members_read_tables" on public.tables
  for select to authenticated using (public.has_restaurant_access(restaurant_id));
create policy "section_write_tables" on public.tables
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'tables'))
  with check (public.has_restaurant_section(restaurant_id, 'tables'));

-- table_sessions  (section 'tables'; writes normally via service-role RPC)
drop policy if exists "owner_manage_table_sessions" on public.table_sessions;
create policy "members_read_table_sessions" on public.table_sessions
  for select to authenticated using (public.has_restaurant_access(restaurant_id));
create policy "section_write_table_sessions" on public.table_sessions
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'tables'))
  with check (public.has_restaurant_section(restaurant_id, 'tables'));

-- menu_categories  (section 'menu')
drop policy if exists "owner_manage_menu_categories" on public.menu_categories;
create policy "members_read_menu_categories" on public.menu_categories
  for select to authenticated using (public.has_restaurant_access(restaurant_id));
create policy "section_write_menu_categories" on public.menu_categories
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'menu'))
  with check (public.has_restaurant_section(restaurant_id, 'menu'));

-- menu_items  (section 'menu'; restaurant resolved via category)
drop policy if exists "owner_manage_menu_items" on public.menu_items;
create policy "members_read_menu_items" on public.menu_items
  for select to authenticated
  using (public.has_restaurant_access(public.menu_category_restaurant(category_id)));
create policy "section_write_menu_items" on public.menu_items
  for all to authenticated
  using (public.has_restaurant_section(public.menu_category_restaurant(category_id), 'menu'))
  with check (public.has_restaurant_section(public.menu_category_restaurant(category_id), 'menu'));

-- orders  (section 'orders'; create is service-role)
drop policy if exists "owner_manage_orders" on public.orders;
create policy "members_read_orders" on public.orders
  for select to authenticated using (public.has_restaurant_access(restaurant_id));
create policy "section_write_orders" on public.orders
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'orders'))
  with check (public.has_restaurant_section(restaurant_id, 'orders'));

-- theme_configs  (section 'theme')
drop policy if exists "owner_manage_theme_configs" on public.theme_configs;
create policy "members_read_theme_configs" on public.theme_configs
  for select to authenticated using (public.has_restaurant_access(restaurant_id));
create policy "section_write_theme_configs" on public.theme_configs
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'theme'))
  with check (public.has_restaurant_section(restaurant_id, 'theme'));

-- service_requests  (section 'orders'; anon insert via service-role unchanged)
drop policy if exists "owner_manage_service_requests" on public.service_requests;
create policy "members_read_service_requests" on public.service_requests
  for select to authenticated using (public.has_restaurant_access(restaurant_id));
create policy "section_write_service_requests" on public.service_requests
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'orders'))
  with check (public.has_restaurant_section(restaurant_id, 'orders'));

-- ── 5. SENSITIVE tables: gated to the 'customers' section ───────────────────

-- loyalty_transactions  (SELECT only; service-role writes)
drop policy if exists "owner_read_restaurant_loyalty" on public.loyalty_transactions;
create policy "section_read_loyalty" on public.loyalty_transactions
  for select to authenticated
  using (public.has_restaurant_section(restaurant_id, 'customers'));

-- customer_segments
drop policy if exists "owner_manage_customer_segments" on public.customer_segments;
create policy "section_manage_customer_segments" on public.customer_segments
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'customers'))
  with check (public.has_restaurant_section(restaurant_id, 'customers'));

-- campaigns
drop policy if exists "owner_manage_campaigns" on public.campaigns;
create policy "section_manage_campaigns" on public.campaigns
  for all to authenticated
  using (public.has_restaurant_section(restaurant_id, 'customers'))
  with check (public.has_restaurant_section(restaurant_id, 'customers'));

-- ── NOTE: UNCHANGED on purpose ──────────────────────────────────────────────
--   restaurants            (owner_manage + anon_read; gate is the app resolver)
--   payment_credentials    (owner-only; members never)
--   kitchen_credentials    (owner-only; members never)
--   customers / customer_consents / campaign_recipients / message_events /
--   order_payment_tokens   (service-role only — no authenticated read path)
--   get_restaurant_customers EXECUTE stays revoked from authenticated
