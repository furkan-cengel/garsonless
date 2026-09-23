-- Tiered provider re-checks for one-time add-on purchases.
--
-- Previously every pending/review purchase was re-checked hourly forever and
-- every paid purchase hourly for two years. Abandoned hosted checkouts never
-- return a payment status, so they stayed "pending" and consumed the 5-row
-- batch indefinitely; paid purchases alone saturated the ~300 checks/hour the
-- per-minute worker can do once a few hundred existed, delaying refund and
-- chargeback detection for everyone.
--
-- Cadence now follows how long each state can still change:
--   initializing/pending  hourly for 1 day, daily until 7 days, then stop
--                         (the hosted checkout token expires within minutes)
--   review                hourly for 1 day, daily until 30 days, then stop
--   paid                  hourly for 1 day, daily until 120 days (card-scheme
--                         dispute window), weekly until 540 days (extended
--                         dispute window), then stop
-- Age is measured from paid_at for paid purchases, otherwise from created_at.

create or replace function public.add_on_reconciliation_interval(
  p_status text,
  p_age interval
) returns interval
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_age < interval '1 day' then interval '1 hour'
    when p_status in ('initializing', 'pending') and p_age < interval '7 days' then interval '1 day'
    when p_status = 'review' and p_age < interval '30 days' then interval '1 day'
    when p_status = 'paid' and p_age < interval '120 days' then interval '1 day'
    when p_status = 'paid' and p_age < interval '540 days' then interval '7 days'
    else null
  end
$$;

revoke all on function public.add_on_reconciliation_interval(text, interval) from public, anon, authenticated;
grant execute on function public.add_on_reconciliation_interval(text, interval) to service_role;

create or replace function public.list_add_on_reconciliation_purchases() returns jsonb
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 with due as (
  select p.id from public.add_on_purchases p
  cross join lateral (
   select public.add_on_reconciliation_interval(
    p.status,
    now() - case when p.status = 'paid' then coalesce(p.paid_at, p.created_at) else p.created_at end
   ) as every
  ) cadence
  where ((p.provider_token is not null and p.status in ('pending','review','paid'))
    or (p.status='initializing' and p.created_at<now()-interval '5 minutes'))
   and cadence.every is not null
   and (p.last_checked_at is null or p.last_checked_at<now()-cadence.every)
  order by p.last_checked_at nulls first,p.created_at for update of p skip locked limit 5
 ), claimed as (
  update public.add_on_purchases p set last_checked_at=now() from due where p.id=due.id returning p.*
 ) select coalesce(jsonb_agg(public.add_on_purchase_json(claimed)),'[]') into result from claimed;
 return result;
end $$;
