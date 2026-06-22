-- Sprint 15 (15a) — Visits + tier (lifetime points) + welcome-bonus foundation.
-- Tiers, reward catalog and welcome_bonus_points are JSONB config (settings.loyalty),
-- so no columns for those. Welcome-bonus idempotency is app-layer (a guard on
-- (customer_id, scope_key, reason='welcome') in verifyOtp), so no index here.

-- 1) Allow a third ledger type: 'visit'.
alter table loyalty_transactions drop constraint loyalty_transactions_type_check;
alter table loyalty_transactions
  add constraint loyalty_transactions_type_check
  check (type in ('stamp', 'points', 'visit'));

-- 2) A visit is credited at table-session CLOSE, not tied to an order, so it
--    needs its own link for idempotency.
alter table loyalty_transactions add column session_id uuid
  references table_sessions(id) on delete set null;

-- 3) VISIT IDEMPOTENCY (critical): one visit per (session, customer). A session
--    closed once credits each member exactly once, no matter how many times the
--    close path re-fires (closeTableSession + deleteTable). Earn/redeem rows
--    leave session_id null, so their existing (order_id,type,direction) key is
--    untouched.
create unique index loyalty_tx_visit_uniq
  on loyalty_transactions(session_id, customer_id, type)
  where session_id is not null;
