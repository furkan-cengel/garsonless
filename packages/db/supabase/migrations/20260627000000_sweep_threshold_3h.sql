-- P3 follow-up — lengthen the safety-net sweep idle threshold 30m → 180m (3h).
--
-- ⚠️ DEPLOY (pg_cron is PER-PROJECT): apply to **DEV now AND PROD at deploy** —
-- the schedule lives in each Postgres project, not the app.
--
-- WHY: as of 2026-06-27 app/İyzico payment NO LONGER auto-closes a table
-- (markOrderPaidDB stamps the bill only; the table is freed solely by an explicit
-- staff close). So a fully-paid table now stays OPEN ("Ödendi") while the
-- customer keeps sitting. The sweep is the BACKSTOP for tables staff forgot to
-- free — it must NOT reap a paid customer who is merely lingering. A 30-minute
-- window was fine when the sweep only caught the rare forgotten table; with every
-- paid table staying open it is too aggressive. 3h ≈ "the table is genuinely
-- vacated", not "the bill was settled a while ago".
--
-- Behaviour is otherwise unchanged: closes ONLY fully-paid idle sessions, never
-- settles money, never touches a session with an unpaid non-cancelled order, tags
-- the close close_reason='auto', credits visits idempotently.

-- Re-declare with the new default (body identical to 20260626000000).
create or replace function sweep_fully_paid_idle_sessions(p_idle_minutes int default 180)
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
       and exists (
         select 1 from orders o
          where o.table_session_id = s.id
            and o.status <> 'cancelled' and o.deleted_at is null)
       and not exists (
         select 1 from orders o
          where o.table_session_id = s.id
            and o.status <> 'cancelled' and o.deleted_at is null
            and o.paid_at is null)
       and (
         select max(o.created_at) from orders o
          where o.table_session_id = s.id
            and o.status <> 'cancelled' and o.deleted_at is null
       ) < now() - make_interval(mins => p_idle_minutes)
  loop
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

revoke execute on function sweep_fully_paid_idle_sessions(int) from public;
revoke execute on function sweep_fully_paid_idle_sessions(int) from anon, authenticated;

-- Reschedule (still every 10 min) with the 3h threshold. Idempotent.
select cron.unschedule('sweep-fully-paid-idle-sessions')
 where exists (select 1 from cron.job where jobname = 'sweep-fully-paid-idle-sessions');

select cron.schedule(
  'sweep-fully-paid-idle-sessions',
  '*/10 * * * *',
  $cron$ select sweep_fully_paid_idle_sessions(180); $cron$
);
