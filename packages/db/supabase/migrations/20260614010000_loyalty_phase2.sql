-- Üyelik + Sadakat — Phase 2: earning ledger + per-item stamp flag.
-- Earning is computed service-role from the order's OWN data (orders.total,
-- orders.items JSONB ∩ menu_items.earns_stamp); never from client input.
--
-- SECURITY: loyalty_transactions is the balance source of truth (balance =
-- sum(delta)). Owner may read their own venue's rows; writes are service-role
-- only; NO anon. Customers reach balances only via the cookie-scoped
-- service-role read (getMemberBalances).

-- ─── per-item stamp flag ───────────────────────────────────────────────────────
alter table menu_items add column earns_stamp boolean not null default false;

-- ─── loyalty_transactions (ledger) ─────────────────────────────────────────────
create table loyalty_transactions (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade, -- earning venue (audit)
  scope_key     uuid not null,            -- balance bucket: restaurant_id OR network sentinel
  order_id      uuid references orders(id) on delete set null,
  type          text not null check (type in ('stamp', 'points')),
  delta         integer not null,
  reason        text not null,            -- 'earn_paid' | 'earn_served'
  created_at    timestamptz not null default now()
);

-- IDEMPOTENCY: at most one stamp row + one points row per order. Neutralizes
-- realtime retries, paid→served sequences, and kitchen re-flips.
create unique index loyalty_tx_order_type_uniq
  on loyalty_transactions(order_id, type) where order_id is not null;

create index loyalty_tx_balance_idx
  on loyalty_transactions(customer_id, scope_key, type);

alter table loyalty_transactions enable row level security;

-- Owner reads their own venue's ledger rows (members overview is Phase 3; policy ready now).
create policy "owner_read_restaurant_loyalty" on loyalty_transactions
  for select to authenticated
  using (exists (
    select 1 from restaurants r
    where r.id = loyalty_transactions.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ));
-- Deliberately NO anon policy and NO write policy → writes are service-role only.
