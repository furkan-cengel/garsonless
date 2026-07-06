-- Customer-facing split payment — P1: schema + core money model + atomic finalize.
--
-- Today settlement is PER-ORDER, all-or-nothing (orders.payment_method + paid_at).
-- Split pay introduces SESSION-level shares: a bill (all a table's rounds) can be
-- covered by many shares, each paid by card (İyzico, self-settling) or declared as
-- cash (staff must physically confirm). A session is EITHER single-payer (existing
-- path, untouched) OR split (P1 decision: no mixing).
--
-- Money invariants preserved from the payment epic:
--  • A customer 'declared' cash share NEVER counts — only a staff-confirmed
--    ('settled', settled_by set) or card-settled ('settled', İyzico) share does.
--  • 'split' orders are COLLECTED (paid_at set, not comp) → count in ciro; the
--    IS DISTINCT FROM 'comp' predicate already includes 'split' as non-comp.
--  • Finalize is atomic + race-safe (session-row lock + closed_at/paid_at guards),
--    same discipline as close_session_if_fully_paid.

-- ── 1. payment_shares (session-level) ───────────────────────────────────────
create table if not exists payment_shares (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references restaurants(id),
  table_session_id  uuid not null references table_sessions(id) on delete cascade,
  amount            numeric not null check (amount >= 0),
  -- a customer share is card or cash (never pos/comp — those are staff-only paths)
  method            text check (method in ('iyzico','cash')),
  -- declared = intent, NOT counted; settled = counted (card callback OR staff cash
  -- confirm); void = cancelled/abandoned (e.g. voided on abnormal close).
  status            text not null default 'declared' check (status in ('declared','settled','void')),
  customer_id       uuid references customers(id),
  label             text,
  -- item-based split: [{order_id, itemId}]; null for free-amount split.
  assigned_items    jsonb,
  -- staff user who confirmed a CASH share (audit); null for card (system) settle.
  settled_by        uuid references auth.users(id),
  settled_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists payment_shares_session_idx on payment_shares(table_session_id);
create index if not exists payment_shares_settled_idx
  on payment_shares(table_session_id) where status = 'settled';

create trigger payment_shares_updated_at
  before update on payment_shares
  for each row execute function public.update_updated_at();

-- ── 2. payment_share_tokens (İyzico, per SHARE) ─────────────────────────────
-- Exact mirror of order_payment_tokens (GAP #2): the checkout token is a secret,
-- kept in a service-role-only side table, NEVER on the anon-readable share row and
-- NOT in the realtime publication. One token ↔ one share.
create table if not exists payment_share_tokens (
  share_id   uuid primary key references payment_shares(id) on delete cascade,
  token      text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists payment_share_tokens_token_idx
  on payment_share_tokens(token);

-- ── 3. 'split' payment method on orders ─────────────────────────────────────
-- When a session is fully covered by settled shares, every non-cancelled order is
-- stamped paid_at + 'split'. 'split' is a COLLECTED method (not comp); the shares
-- table is the source of truth for the card/cash sub-breakdown.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('iyzico','cash','pos','comp','split'));

-- ── 4. RLS + grants ─────────────────────────────────────────────────────────
alter table payment_shares enable row level security;
alter table payment_share_tokens enable row level security; -- ZERO policies → service-role only

-- Customer (anon) may READ their table's shares — but only CUSTOMER-SAFE columns.
-- settled_by / settled_at / customer_id are excluded from the grant (staff audit +
-- cross-venue-correlation risk), exactly like orders' column-scoped anon grant.
-- Column grants are respected by both REST and realtime column security.
revoke all on payment_shares from anon;
grant select (
  id, restaurant_id, table_session_id, amount, method, status, label,
  assigned_items, created_at, updated_at
) on payment_shares to anon;

create policy "anon_read_payment_shares" on payment_shares
  for select to anon using (true);

-- Staff (owner or active member) read — for dashboard reads + realtime (P3 UI).
-- All WRITES (declare / settle / void) go through service-role server actions
-- gated by the customer session or assertAccess — never a direct anon/authenticated
-- write, so there is deliberately NO insert/update policy here. A customer can
-- therefore NEVER flip a cash share to 'settled' (RLS-enforced cash authority).
create policy "staff_read_payment_shares" on payment_shares
  for select to authenticated
  using (
    exists (select 1 from restaurants r
      where r.id = payment_shares.restaurant_id and r.owner_id = auth.uid() and r.deleted_at is null)
    or exists (select 1 from restaurant_members m
      where m.restaurant_id = payment_shares.restaurant_id and m.user_id = auth.uid() and m.status = 'active')
  );

alter publication supabase_realtime add table payment_shares;

-- ── 5. finalize_split_if_covered — atomic, race-safe ────────────────────────
-- After ANY share settles, check whether settled shares now cover the session
-- total; if so, stamp all non-cancelled unpaid orders paid + 'split' and close.
-- SELECT ... FOR UPDATE serializes concurrent finalizers on the session row, so
-- the LAST settle to commit always sees the full settled sum (no under-count);
-- the paid_at-null / closed_at-null guards make the losers no-op (no double-count).
create or replace function finalize_split_if_covered(p_session_id uuid)
returns boolean language plpgsql as $$
declare
  v_total   numeric;
  v_settled numeric;
begin
  -- serialize concurrent finalizers on this session
  perform 1 from table_sessions s where s.id = p_session_id for update;

  select coalesce(sum(o.total), 0) into v_total
    from orders o
   where o.table_session_id = p_session_id
     and o.status <> 'cancelled'
     and o.deleted_at is null;

  select coalesce(sum(ps.amount), 0) into v_settled
    from payment_shares ps
   where ps.table_session_id = p_session_id
     and ps.status = 'settled';

  -- never finalize a vacuous session; require FULL coverage
  if v_total <= 0 or v_settled < v_total then
    return false;
  end if;

  update orders o
     set paid_at = now(), payment_method = 'split', updated_at = now()
   where o.table_session_id = p_session_id
     and o.status <> 'cancelled'
     and o.deleted_at is null
     and o.paid_at is null;

  update table_sessions s
     set closed_at = now(), updated_at = now()
   where s.id = p_session_id
     and s.closed_at is null;

  return true;
end $$;

-- Service-role only (mirrors close_session_if_fully_paid).
revoke execute on function finalize_split_if_covered(uuid) from public;
revoke execute on function finalize_split_if_covered(uuid) from anon, authenticated;
