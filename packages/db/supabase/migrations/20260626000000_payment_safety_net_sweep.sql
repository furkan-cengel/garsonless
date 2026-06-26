-- P3 — safety-net sweep: a pg_cron job that closes FULLY-PAID idle sessions.
--
-- ⚠️ DEPLOY (pg_cron is PER-PROJECT): this migration enables the extension AND
-- schedules the job IN THE DATABASE. It must be applied to **DEV now AND PROD at
-- deploy** — the schedule + extension live in each Postgres project, not the app,
-- so pushing only to dev leaves prod without the sweep. (Some hosts require
-- enabling pg_cron from the project dashboard first; `create extension … if not
-- exists` is the documented Supabase path and is idempotent.)
--
-- WHAT IT DOES / DOESN'T:
--   * Closes ONLY sessions that are already fully paid (no unpaid non-cancelled
--     order) and idle (newest live order older than the threshold). It NEVER
--     settles money. A session with ANY unpaid non-cancelled order is LEFT OPEN —
--     the deep 8h lazy auto-close + manual settlement own those.
--   * Credits visits exactly like the app's close path (idempotent per member),
--     and tags the close as SYSTEM via close_reason='auto'.
--
-- close_reason='auto' is a SYSTEM tag, distinct from a staff walkout/dispute
-- reason. A fully-paid swept session is a NORMAL close (no money abandoned), so
-- the abnormal/walkout report must read:
--     closed_at is not null AND close_reason is not null AND close_reason <> 'auto'
-- (nothing reads close_reason yet, so this only defines the future report.)

create extension if not exists pg_cron;

-- ── sweep function ──────────────────────────────────────────────────────────
-- SECURITY DEFINER (owner-privileged system job) + locked search_path. Returns
-- the number of sessions closed. p_idle_minutes guards against reaping a session
-- that's still actively ordering (default 30m).
create or replace function sweep_fully_paid_idle_sessions(p_idle_minutes int default 30)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_session record;
  v_closed  int := 0;
begin
  for v_session in
    select s.id, s.restaurant_id
      from table_sessions s
     where s.closed_at is null
       -- at least one real (non-cancelled, live) order — never close a vacuous session
       and exists (
         select 1 from orders o
          where o.table_session_id = s.id
            and o.status <> 'cancelled' and o.deleted_at is null)
       -- FULLY PAID: no unpaid non-cancelled order remains
       and not exists (
         select 1 from orders o
          where o.table_session_id = s.id
            and o.status <> 'cancelled' and o.deleted_at is null
            and o.paid_at is null)
       -- IDLE: newest live order older than the threshold
       and (
         select max(o.created_at) from orders o
          where o.table_session_id = s.id
            and o.status <> 'cancelled' and o.deleted_at is null
       ) < now() - make_interval(mins => p_idle_minutes)
  loop
    -- Race-safe close (mirrors close_session_if_fully_paid's closed_at + fully-paid
    -- guard) plus the system tag. Re-checks fully-paid inside the UPDATE so a
    -- payment racing in between SELECT and UPDATE can't be reaped while unpaid.
    update table_sessions s
       set closed_at = now(), updated_at = now(), close_reason = 'auto'
     where s.id = v_session.id
       and s.closed_at is null
       and not exists (
         select 1 from orders o
          where o.table_session_id = s.id
            and o.status <> 'cancelled' and o.deleted_at is null
            and o.paid_at is null);

    if found then
      v_closed := v_closed + 1;
      -- Credit +1 visit per distinct member with a live order. Idempotent on the
      -- PARTIAL index loyalty_tx_visit_uniq(session_id, customer_id, type) WHERE
      -- session_id is not null — the ON CONFLICT MUST repeat that predicate so
      -- Postgres can infer the partial index (session_id is always set here).
      -- scope_key mirrors the app: network scope → zero-UUID bucket, else the rid.
      insert into loyalty_transactions (customer_id, restaurant_id, scope_key, session_id, type, delta, reason, direction)
      select distinct o.customer_id, v_session.restaurant_id,
             case when (r.settings -> 'loyalty' ->> 'scope') = 'network'
                  then '00000000-0000-0000-0000-000000000000'::uuid
                  else v_session.restaurant_id end,
             v_session.id, 'visit', 1, 'visit', 'earn'
        from orders o
        join restaurants r on r.id = v_session.restaurant_id
       where o.table_session_id = v_session.id
         and o.status <> 'cancelled' and o.deleted_at is null
         and o.customer_id is not null
      on conflict (session_id, customer_id, type) where session_id is not null do nothing;
    end if;
  end loop;

  return v_closed;
end $$;

-- System-only: no anon/authenticated caller. pg_cron runs it as the owner; the
-- service role retains execute (same discipline as close_session_if_fully_paid).
revoke execute on function sweep_fully_paid_idle_sessions(int) from public;
revoke execute on function sweep_fully_paid_idle_sessions(int) from anon, authenticated;

-- ── schedule: every 10 minutes ──────────────────────────────────────────────
-- Idempotent: drop a prior job of the same name before (re)scheduling.
select cron.unschedule('sweep-fully-paid-idle-sessions')
 where exists (select 1 from cron.job where jobname = 'sweep-fully-paid-idle-sessions');

select cron.schedule(
  'sweep-fully-paid-idle-sessions',
  '*/10 * * * *',
  $cron$ select sweep_fully_paid_idle_sessions(30); $cron$
);
