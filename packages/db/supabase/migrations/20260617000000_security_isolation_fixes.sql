-- Security: multi-tenant isolation fixes (audit gaps #1, #2, #3-support).
-- All three close cross-tenant exposure on an anon-readable surface. None of
-- these touch tenant CONFIG (loyalty/theme/etc.) — they only relocate secrets
-- out of anon-readable blobs and tighten the anon column surface on orders.

-- ════════════════════════════════════════════════════════════════════════════
-- GAP #1 — kitchen_token was stored in restaurants.settings, which is
-- anon-readable (anon_read_restaurants + the menu's select('*')). A kitchen
-- token is a secret (it gates KDS writes), so it must live OUTSIDE any
-- anon-readable column — same discipline as payment_credentials.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists kitchen_credentials (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  token         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table kitchen_credentials enable row level security;

-- Owner manages their own restaurant's kitchen token. Deliberately NO anon policy.
drop policy if exists "owner_manage_kitchen_credentials" on kitchen_credentials;
create policy "owner_manage_kitchen_credentials" on kitchen_credentials
  for all to authenticated
  using (exists (
    select 1 from restaurants r
    where r.id = kitchen_credentials.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ))
  with check (exists (
    select 1 from restaurants r
    where r.id = kitchen_credentials.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ));

-- Relocate existing tokens out of settings (value preserved), then strip the
-- secret key from the anon-readable settings blob.
insert into kitchen_credentials (restaurant_id, token)
  select id, settings->>'kitchen_token'
  from restaurants
  where settings ? 'kitchen_token' and coalesce(settings->>'kitchen_token','') <> ''
on conflict (restaurant_id) do update set token = excluded.token, updated_at = now();

update restaurants set settings = settings - 'kitchen_token'
  where settings ? 'kitchen_token';

create trigger kitchen_credentials_updated_at
  before update on kitchen_credentials
  for each row execute function update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- GAP #2a — payment_token lived on orders, which anon can read (24h policy) and
-- stream via realtime. The İyzico checkout token is a secret used only by the
-- server-side callback (token → order → restaurant → credentials). Move it to a
-- service-role-only side table that is NOT in the realtime publication, then
-- drop the column so it can never appear in any anon REST/realtime payload.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists order_payment_tokens (
  order_id   uuid primary key references orders(id) on delete cascade,
  token      text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists order_payment_tokens_token_idx
  on order_payment_tokens(token);

-- Service-role only: RLS enabled with ZERO policies → anon + authenticated are
-- both denied; only the service-role key (which bypasses RLS) can read/write.
alter table order_payment_tokens enable row level security;

-- Backfill before dropping the column.
insert into order_payment_tokens (order_id, token)
  select id, payment_token
  from orders
  where payment_token is not null
on conflict (order_id) do nothing;

drop index if exists orders_payment_token_idx;
alter table orders drop column if exists payment_token;

-- ════════════════════════════════════════════════════════════════════════════
-- GAP #2b — anon could read EVERY column of recent orders (incl. customer_id),
-- enabling cross-venue customer correlation. The menu app only ever selects
-- operational columns (id, status, total, paid_at, created_at, items, …), never
-- customer_id. Replace anon's table-wide SELECT with a column-scoped grant so
-- customer_id is unreachable by anon (REST + realtime column security).
-- authenticated (owners, RLS-gated) and service_role keep full access.
-- ════════════════════════════════════════════════════════════════════════════

revoke select on public.orders from anon;
grant select (
  id, restaurant_id, table_id, session_id, status, items, total,
  created_at, updated_at, deleted_at, paid_at, table_session_id
) on public.orders to anon;
