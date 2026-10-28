-- Pano business view: what the owner (or a member with the analytics section)
-- reads first. Revenue always uses the collected predicate: paid_at set, not
-- cancelled, payment_method not 'comp'. "Same time" comparisons cut the earlier
-- day at the same local clock time as now, so a half-finished day is never
-- compared with a whole one.

create or replace function public.read_dashboard_pano_business(
  p_restaurant_id uuid,
  p_now timestamptz,
  p_timezone text,
  p_period_days integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  local_day timestamp := date_trunc('day', p_now at time zone p_timezone);
  elapsed interval := (p_now at time zone p_timezone) - date_trunc('day', p_now at time zone p_timezone);
  today_start timestamptz := date_trunc('day', p_now at time zone p_timezone) at time zone p_timezone;
  yesterday_start timestamptz := (date_trunc('day', p_now at time zone p_timezone) - interval '1 day') at time zone p_timezone;
  last_week_start timestamptz := (date_trunc('day', p_now at time zone p_timezone) - interval '7 days') at time zone p_timezone;
  period_days integer := case when p_period_days in (7, 30) then p_period_days else 7 end;
  period_start timestamptz;
  previous_start timestamptz;
  result jsonb;
begin
  -- Periods end with today: "7 days" is today plus the six days before it.
  period_start := (local_day - make_interval(days => period_days - 1)) at time zone p_timezone;
  previous_start := (local_day - make_interval(days => period_days * 2 - 1)) at time zone p_timezone;

  with collected as (
    select o.total::numeric as total, o.paid_at, o.payment_method, o.items
    from public.orders o
    where o.restaurant_id = p_restaurant_id and o.deleted_at is null
      and o.paid_at >= least(previous_start, last_week_start - interval '21 days', p_now - interval '30 days')
      and o.paid_at <= p_now
      and o.status::text <> 'cancelled' and o.payment_method is distinct from 'comp'
  ),
  window_sum as (
    select
      coalesce(sum(total) filter (where paid_at >= today_start), 0) as today_revenue,
      count(*) filter (where paid_at >= today_start) as today_orders,
      coalesce(sum(total) filter (where paid_at >= today_start and payment_method = 'cash'), 0) as today_cash,
      coalesce(sum(total) filter (where paid_at >= yesterday_start and paid_at < yesterday_start + elapsed), 0) as yesterday_same_time,
      count(*) filter (where paid_at >= yesterday_start and paid_at < yesterday_start + elapsed) as yesterday_same_time_orders,
      coalesce(sum(total) filter (where paid_at >= yesterday_start and paid_at < today_start), 0) as yesterday_revenue,
      count(*) filter (where paid_at >= yesterday_start and paid_at < today_start) as yesterday_orders,
      coalesce(sum(total) filter (where paid_at >= last_week_start and paid_at < last_week_start + elapsed), 0) as last_week_same_time,
      coalesce(sum(total) filter (where paid_at >= last_week_start and paid_at < last_week_start + interval '1 day'), 0) as last_week_day,
      coalesce(sum(total) filter (where paid_at >= period_start), 0) as period_revenue,
      count(*) filter (where paid_at >= period_start) as period_orders,
      coalesce(sum(total) filter (where paid_at >= previous_start and paid_at < period_start), 0) as previous_revenue,
      count(*) filter (where paid_at >= previous_start and paid_at < period_start) as previous_orders
    from collected
  ),
  hourly as (
    select
      jsonb_agg(coalesce((select sum(total) from collected where paid_at >= today_start and extract(hour from paid_at at time zone p_timezone) = h), 0) order by h) as today,
      jsonb_agg(coalesce((select sum(total) from collected where paid_at >= last_week_start and paid_at < last_week_start + interval '1 day' and extract(hour from paid_at at time zone p_timezone) = h), 0) order by h) as last_week
    from generate_series(0, 23) h
  ),
  -- The busiest hour on the last four same weekdays, by collected revenue.
  peak as (
    select extract(hour from paid_at at time zone p_timezone)::int as hour
    from collected
    where (paid_at at time zone p_timezone)::date in (
      (local_day - interval '7 days')::date, (local_day - interval '14 days')::date,
      (local_day - interval '21 days')::date, (local_day - interval '28 days')::date)
    group by 1 order by sum(total) desc, 1 limit 1
  ),
  daily as (
    select
      jsonb_agg(jsonb_build_object(
        'date', d::date,
        'current', coalesce((select sum(total) from collected where (paid_at at time zone p_timezone)::date = d::date), 0),
        'previous', coalesce((select sum(total) from collected where (paid_at at time zone p_timezone)::date = (d - make_interval(days => period_days))::date), 0)
      ) order by d) as series
    from generate_series(local_day - make_interval(days => period_days - 1), local_day, interval '1 day') d
  ),
  sold as (
    select coalesce(nullif(btrim(item.value ->> 'name'), ''), 'Ürün') as name,
      sum(case when coalesce(item.value ->> 'quantity', item.value ->> 'qty', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (coalesce(item.value ->> 'quantity', item.value ->> 'qty'))::numeric else 1 end) as quantity
    from collected o
    cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) item(value)
    where o.paid_at >= p_now - interval '30 days'
    group by 1
  ),
  day_ops as (
    select
      coalesce(sum(o.total) filter (where o.payment_method = 'comp' and o.status::text <> 'cancelled' and o.paid_at >= today_start), 0) as comp_total,
      count(*) filter (where o.status::text = 'cancelled' and o.created_at >= today_start) as cancelled_count,
      coalesce(sum(o.total) filter (where o.status::text = 'cancelled' and o.created_at >= today_start), 0) as cancelled_total
    from public.orders o
    where o.restaurant_id = p_restaurant_id and o.deleted_at is null
      and (o.paid_at >= today_start or o.created_at >= today_start)
  ),
  food as (
    select coalesce(sum(-m.quantity * m.cost), 0) as consumption,
      count(*) > 0 as has_sales,
      coalesce(bool_or(m.cost is null), false) as missing_cost
    from public.inventory_movements m
    join public.inventory_documents d on d.id = m.document_id
    where m.restaurant_id = p_restaurant_id and d.kind in ('sale', 'cancellation_return')
      and m.created_at >= p_now - interval '7 days'
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
      'revenue', w.today_revenue, 'paidOrders', w.today_orders, 'cash', w.today_cash,
      'comp', o.comp_total, 'cancelledCount', o.cancelled_count, 'cancelledTotal', o.cancelled_total),
    'yesterday', jsonb_build_object('revenue', w.yesterday_revenue, 'paidOrders', w.yesterday_orders,
      'sameTimeRevenue', w.yesterday_same_time, 'sameTimePaidOrders', w.yesterday_same_time_orders),
    'lastWeekDay', jsonb_build_object('revenue', w.last_week_day, 'sameTimeRevenue', w.last_week_same_time),
    'hourly', jsonb_build_object('today', h.today, 'lastWeekDay', h.last_week),
    'peakHour', (select hour from peak),
    'period', jsonb_build_object('days', period_days, 'revenue', w.period_revenue, 'paidOrders', w.period_orders,
      'previousRevenue', w.previous_revenue, 'previousPaidOrders', w.previous_orders, 'daily', dl.series),
    'lowItems', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'count', s.quantity) order by s.quantity, s.name)
      from (select * from sold order by quantity, name limit 5) s), '[]'::jsonb),
    'foodCost', jsonb_build_object('consumption', f.consumption, 'hasSales', f.has_sales, 'missingCost', f.missing_cost,
      'revenue', (select coalesce(sum(total), 0) from collected where paid_at >= p_now - interval '7 days'))
  ) into result
  from window_sum w, hourly h, daily dl, day_ops o, food f;
  return result;
end $$;

revoke all on function public.read_dashboard_pano_business(uuid, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.read_dashboard_pano_business(uuid, timestamptz, text, integer) to service_role;
