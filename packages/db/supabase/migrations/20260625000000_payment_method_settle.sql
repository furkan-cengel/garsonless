-- Payment closes the table — P1: per-order payment method + race-safe auto-close.
--
-- Today the ONLY code path that sets orders.paid_at is the İyzico callback, so a
-- cash/POS café shows ₺0 collected ciro forever and adisyon sessions never close
-- on payment. P1 adds the per-order settlement method + the missing
-- "every order paid → close the session" rule (atomic / race-safe).

-- ── 1. Per-order payment method ─────────────────────────────────────────────
-- null = unpaid OR legacy-paid-unknown. Set at the same instant paid_at is set.
-- Methods: iyzico (online), cash (Nakit), pos (Fiziksel POS), comp (İkram).
-- COMP is settled (paid_at set) + total kept, but is ₺0 COLLECTED: every
-- collected-ciro query excludes payment_method='comp' while STILL counting
-- legacy null-method paid orders (the IS DISTINCT FROM 'comp' rule).
alter table orders
  add column if not exists payment_method text
    check (payment_method in ('iyzico','cash','pos','comp'));

-- Audit: which staff user stamped a manual cash/pos/comp settlement.
-- null for İyzico (system) and the future safety-net sweep (system).
alter table orders
  add column if not exists settled_by uuid references auth.users(id);

-- SECURITY: payment_method + settled_by are DELIBERATELY NOT added to the anon
-- column grant (20260617000000). Settlement data must never reach the public
-- menu via REST or the orders realtime publication — same discipline as
-- customer_tier (20260618010000). The anon grant stays exactly as-is.

-- ── 2. Backfill existing paid orders ────────────────────────────────────────
-- Every paid order today came through İyzico and therefore has an
-- order_payment_tokens row → stamp 'iyzico'. A paid order WITHOUT a token (none
-- expected in current data) is left null = legacy-collected, NOT comp. We never
-- invent 'cash' — that would fabricate a revenue narrative.
update orders o
   set payment_method = 'iyzico'
 where o.paid_at is not null
   and o.payment_method is null
   and exists (select 1 from order_payment_tokens t where t.order_id = o.id);

-- ── 3. Race-safe auto-close on full payment ─────────────────────────────────
-- After ANY order's paid_at is set, close the table session iff every
-- non-cancelled order in it is now paid. A single conditional UPDATE is atomic:
-- two near-simultaneous final payments both call this, the `closed_at IS NULL`
-- guard lets exactly ONE win the close (the other affects 0 rows and no-ops).
-- Mirrors the one-open-per-table partial-unique discipline in
-- open_or_get_table_session. comp counts as paid (paid_at is set), so a fully
-- comped or mixed cash+comp+iyzico table closes correctly.
create or replace function close_session_if_fully_paid(p_session_id uuid)
returns boolean language plpgsql as $$
begin
  update table_sessions s
     set closed_at = now(), updated_at = now()
   where s.id = p_session_id
     and s.closed_at is null
     -- at least one real order (never close a vacuous / all-cancelled session)
     and exists (
       select 1 from orders o
        where o.table_session_id = s.id
          and o.status <> 'cancelled'
          and o.deleted_at is null)
     -- and NO unpaid non-cancelled order remains
     and not exists (
       select 1 from orders o
        where o.table_session_id = s.id
          and o.status <> 'cancelled'
          and o.deleted_at is null
          and o.paid_at is null);
  return found;
end $$;

-- Service-role only: anon/authenticated must not close sessions via the rpc
-- endpoint (mirrors open_or_get_table_session).
revoke execute on function close_session_if_fully_paid(uuid) from public;
revoke execute on function close_session_if_fully_paid(uuid) from anon, authenticated;
