-- P2 — manual settlement: NO close path silently drops unpaid money.
--
-- P1 gave us per-order settlement + the race-safe auto-close
-- (close_session_if_fully_paid only ever fires when EVERY non-cancelled order is
-- paid → a normal close leaves close_reason null). The remaining hole is the
-- MANUAL closeTableSession: today it stamps closed_at and silently abandons any
-- unpaid non-cancelled total. P2 forbids that — a session that still owes money
-- can only close as an explicit, RECORDED abnormal decision (walkout/dispute).

-- close_reason: null on a NORMAL close (all orders settled). NON-NULL marks an
-- ABNORMAL close — staff knowingly closed the adisyon with unpaid money, the
-- unpaid orders STAY unpaid, and the reason is the audit record of that choice.
-- The presence of a reason is the abnormal flag (one column, no drift); an
-- abnormal-sessions report is `closed_at is not null and close_reason is not null`.
alter table table_sessions
  add column if not exists close_reason text;

-- No grant/RLS change: table_sessions is already owner/member-scoped via the
-- existing dashboard policies; close_reason rides the same access as closed_at.
-- The auto-close RPC (close_session_if_fully_paid) never sets close_reason, so
-- every payment-driven close stays "normal" exactly as intended.
