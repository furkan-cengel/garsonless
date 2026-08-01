-- Pano analytics are folded in PostgreSQL so the dashboard never downloads a
-- rolling month of raw order payloads merely to render KPI and heatmap cards.
-- The application layer verifies the tenant before the service-role adapter
-- invokes this read-only function.

create or replace function public.read_dashboard_pano_metrics(
  p_restaurant_id uuid,
  p_today_start timestamptz,
  p_yesterday_start timestamptz,
  p_heatmap_start timestamptz,
  p_timezone text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base_orders as (
    select
      o.id,
      o.status,
      coalesce(o.total, 0)::numeric as total,
      o.table_id,
      o.created_at,
      o.paid_at,
      o.payment_method,
      o.items
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_heatmap_start
      and o.deleted_at is null
  ),
  volume_orders as (
    select * from base_orders where status <> 'cancelled'
  ),
  collected_orders as (
    select *
    from base_orders
    where paid_at is not null
      and status <> 'cancelled'
      and (payment_method is null or payment_method <> 'comp')
      and paid_at >= p_yesterday_start
  ),
  session_metrics as (
    select
      count(*) filter (where s.opened_at >= p_today_start)::int as today_count,
      count(*) filter (
        where s.opened_at >= p_yesterday_start and s.opened_at < p_today_start
      )::int as yesterday_count
    from public.table_sessions s
    where s.restaurant_id = p_restaurant_id
      and s.opened_at >= p_yesterday_start
  ),
  hourly_sales as (
    select jsonb_agg(
      jsonb_build_object(
        'hour', hours.hour,
        'total', coalesce(sales.total, 0)
      ) order by hours.hour
    ) as value
    from generate_series(0, 23) as hours(hour)
    left join (
      select
        extract(hour from (paid_at at time zone p_timezone))::int as hour,
        sum(total) as total
      from collected_orders
      where paid_at >= p_today_start
      group by 1
    ) sales using (hour)
  ),
  recent_orders as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', recent.id,
      'status', recent.status,
      'total', recent.total,
      'tableId', recent.table_id,
      'tableLabel', recent.table_label,
      'createdAt', recent.created_at
    ) order by recent.created_at desc), '[]'::jsonb) as value
    from (
      select o.id, o.status, o.total, o.table_id, t.label as table_label, o.created_at
      from volume_orders o
      left join public.tables t
        on t.id = o.table_id and t.restaurant_id = p_restaurant_id
      where o.created_at >= p_today_start
      order by o.created_at desc
      limit 7
    ) recent
  ),
  item_rows as (
    select
      coalesce(nullif(btrim(item.value ->> 'name'), ''), 'Ürün') as name,
      case
        when coalesce(item.value ->> 'quantity', item.value ->> 'qty', '')
          ~ '^[0-9]+([.][0-9]+)?$'
          then greatest(coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric, 0)
        else 1
      end as quantity,
      case
        when coalesce(item.value ->> 'price', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then greatest((item.value ->> 'price')::numeric, 0)
        else 0
      end + case
        when coalesce(item.value ->> 'modifiersPriceDelta', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (item.value ->> 'modifiersPriceDelta')::numeric
        else 0
      end as unit_price
    from collected_orders o
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
    ) item(value)
    where o.paid_at >= p_today_start
  ),
  top_items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', ranked.name,
      'count', ranked.item_count,
      'revenue', ranked.revenue
    ) order by ranked.item_count desc, ranked.name), '[]'::jsonb) as value
    from (
      select
        name,
        sum(quantity)::numeric as item_count,
        sum(greatest(unit_price, 0) * quantity)::numeric as revenue
      from item_rows
      group by name
      order by item_count desc, name
      limit 5
    ) ranked
  ),
  heatmap_counts as (
    select
      (extract(isodow from (created_at at time zone p_timezone))::int - 1) as day,
      extract(hour from (created_at at time zone p_timezone))::int as hour,
      count(*)::int as count
    from volume_orders
    group by 1, 2
  ),
  heatmap as (
    select jsonb_agg(jsonb_build_object(
      'day', days.day,
      'hour', hours.hour,
      'count', coalesce(counts.count, 0)
    ) order by days.day, hours.hour) as value
    from generate_series(0, 6) as days(day)
    cross join generate_series(8, 22) as hours(hour)
    left join heatmap_counts counts using (day, hour)
  )
  select jsonb_build_object(
    'revenue', coalesce((select sum(total) from collected_orders where paid_at >= p_today_start), 0),
    'revenueYesterday', coalesce((select sum(total) from collected_orders where paid_at < p_today_start), 0),
    'orders', (select count(*) from volume_orders where created_at >= p_today_start),
    'ordersYesterday', (select count(*) from volume_orders where created_at >= p_yesterday_start and created_at < p_today_start),
    'paidOrders', (select count(*) from collected_orders where paid_at >= p_today_start),
    'paidOrdersYesterday', (select count(*) from collected_orders where paid_at < p_today_start),
    'activeOrders', (
      select count(*) from public.orders o
      where o.restaurant_id = p_restaurant_id
        and o.status in ('pending', 'pending_approval', 'sent_to_kitchen', 'preparing', 'ready', 'served')
        and o.deleted_at is null
    ),
    'sessions', coalesce((select today_count from session_metrics), 0),
    'sessionsYesterday', coalesce((select yesterday_count from session_metrics), 0),
    'hourlySales', coalesce((select value from hourly_sales), '[]'::jsonb),
    'recentOrders', coalesce((select value from recent_orders), '[]'::jsonb),
    'topItems', coalesce((select value from top_items), '[]'::jsonb),
    'heatmap', coalesce((select value from heatmap), '[]'::jsonb)
  );
$$;

revoke all on function public.read_dashboard_pano_metrics(
  uuid, timestamptz, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.read_dashboard_pano_metrics(
  uuid, timestamptz, timestamptz, timestamptz, text
) to service_role;
