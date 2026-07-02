-- Orders board P2 — cancel audit fields + per-status stage timestamps.
--
-- 1. cancel_reason / cancelled_by: who cancelled and why. Stamped by the new
--    single cancel path (cancelOrderDB); unlocks the future cancellation-reason
--    report (Analytics Wave-2). cancelled_by mirrors the settled_by pattern.
-- 2. sent_to_kitchen_at / ready_at / served_at: real stage timestamps so the
--    board can show honest per-STAGE aging, a real prep-time KPI and true
--    times on the status timeline. NO backfill — past orders keep NULL (we do
--    not fabricate stage history); stamping starts going forward.
--
-- Stamping is a DB TRIGGER (not app code) — the payment-epic race-safety
-- lesson: every writer (dashboard action, kitchen action, any future path)
-- inherits it atomically. coalesce() makes it idempotent: a retry, re-flip or
-- optimistic double-write can never overwrite an existing stamp.
--
-- SECURITY: NONE of the 5 new columns is added to the anon column grant from
-- 20260617000000 (grants are column-scoped, so new columns are automatically
-- invisible to anon). cancel_reason/cancelled_by are staff audit data; the
-- stage timestamps stay off the public surface (customer tracking only needs
-- `status`). Authenticated owner/member realtime payloads carry them (RLS).

alter table public.orders
  add column if not exists cancel_reason text,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists sent_to_kitchen_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists served_at timestamptz;

-- Stage-timestamp stamping. UPDATE: only when status actually changes; each
-- stamp is coalesce-guarded (first transition wins, later flips never
-- overwrite). 'preparing' also stamps sent_to_kitchen_at (kitchen flows may
-- enter the pipeline there); legacy status 'paid' stamps nothing (payment is
-- a column, not a kitchen stage).
create or replace function public.set_order_stage_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status in ('sent_to_kitchen', 'preparing') then
    new.sent_to_kitchen_at := coalesce(old.sent_to_kitchen_at, new.sent_to_kitchen_at, now());
  elsif new.status = 'ready' then
    new.ready_at := coalesce(old.ready_at, new.ready_at, now());
  elsif new.status = 'served' then
    new.served_at := coalesce(old.served_at, new.served_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stage_timestamps_update on public.orders;
create trigger orders_stage_timestamps_update
  before update of status on public.orders
  for each row
  when (new.status is distinct from old.status)
  execute function public.set_order_stage_timestamps();

-- INSERT twin: dashboard manual orders are CREATED already in
-- 'sent_to_kitchen' (they never pass through the UPDATE path), so the kitchen
-- entry is the creation moment.
create or replace function public.set_order_stage_timestamps_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status in ('sent_to_kitchen', 'preparing') then
    new.sent_to_kitchen_at := coalesce(new.sent_to_kitchen_at, now());
  elsif new.status = 'ready' then
    new.ready_at := coalesce(new.ready_at, now());
  elsif new.status = 'served' then
    new.served_at := coalesce(new.served_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stage_timestamps_insert on public.orders;
create trigger orders_stage_timestamps_insert
  before insert on public.orders
  for each row
  execute function public.set_order_stage_timestamps_insert();
