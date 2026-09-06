-- Include every restaurant-local hour; preserve RPC signature and financial rules.
create or replace function public.read_analytics_core_metrics(
  p_restaurant_id uuid,
  p_since timestamptz,
  p_current_start timestamptz,
  p_before timestamptz,
  p_timezone text,
  p_source text,
  p_payment_method text,
  p_status text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with volume_orders as (
    select o.created_at, o.session_id
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_since
      and o.created_at < p_before
      and o.deleted_at is null
      and o.status <> 'cancelled'
      and (p_source is null or o.source = p_source)
      and (p_status is null or o.status = p_status)
      and (
        p_payment_method is null
        or (p_payment_method = 'unknown' and o.payment_method is null)
        or (p_payment_method <> 'unknown' and o.payment_method = p_payment_method)
      )
  ),
  collected_orders as (
    select o.id, coalesce(o.total, 0)::numeric as total, o.paid_at, o.items
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.paid_at >= p_since
      and o.paid_at < p_before
      and o.deleted_at is null
      and (o.payment_method is null or o.payment_method <> 'comp')
      and (p_source is null or o.source = p_source)
      and (p_status is null or o.status = p_status)
      and (
        p_payment_method is null
        or (p_payment_method = 'unknown' and o.payment_method is null)
        or (p_payment_method <> 'unknown' and o.payment_method = p_payment_method)
      )
  ),
  sales_groups as (
    select
      case when o.paid_at >= p_current_start then 'current' else 'previous' end as period,
      to_char(o.paid_at at time zone p_timezone, 'YYYY-MM-DD') as day,
      extract(hour from (o.paid_at at time zone p_timezone))::int as hour,
      sum(o.total)::numeric as total
    from collected_orders o
    group by 1, 2, 3
  ),
  item_lines as (
    select
      o.id as order_id,
      case when o.paid_at >= p_current_start then 'current' else 'previous' end as period,
      o.total as order_total,
      item.ordinality,
      coalesce(nullif(btrim(item.value ->> 'name'), ''), 'Ürün') as name,
      case
        when coalesce(item.value ->> 'quantity', item.value ->> 'qty', '') ~ '^[0-9]+([.][0-9]+)?$'
          and coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric > 0
          then coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric
        else 1
      end as quantity,
      round(greatest(
        coalesce(case when coalesce(item.value ->> 'price', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (item.value ->> 'price')::numeric end, 0)
        + coalesce(case when coalesce(item.value ->> 'modifiersPriceDelta', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (item.value ->> 'modifiersPriceDelta')::numeric end, 0),
        0
      ) * case
        when coalesce(item.value ->> 'quantity', item.value ->> 'qty', '') ~ '^[0-9]+([.][0-9]+)?$'
          and coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric > 0
          then coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric
        else 1
      end, 2) as line_gross
    from collected_orders o
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
    ) with ordinality as item(value, ordinality)
  ),
  allocated_base as (
    select
      l.*,
      sum(l.line_gross) over (partition by l.order_id) as line_total,
      row_number() over (
        partition by l.order_id order by l.line_gross desc, l.ordinality
      ) as gross_rank
    from item_lines l
  ),
  allocated_round as (
    select
      b.*,
      round(
        b.line_gross * least(greatest(b.order_total, 0), b.line_total)
        / nullif(b.line_total, 0),
        2
      ) as allocated,
      least(greatest(b.order_total, 0), b.line_total) as product_target
    from allocated_base b
    where b.line_total > 0
  ),
  allocated_lines as (
    select
      a.period,
      a.name,
      a.quantity,
      a.allocated + case when a.gross_rank = 1 then
        round(a.product_target - sum(a.allocated) over (partition by a.order_id), 2)
      else 0 end as revenue
    from allocated_round a
  ),
  product_groups as (
    select period, name, sum(quantity)::numeric as count, round(sum(revenue), 2) as revenue
    from allocated_lines
    group by period, name
  ),
  product_cardinality as (
    select count(distinct name)::int as value from product_groups
  ),
  bounded_products as (
    select * from product_groups
    order by period, revenue desc, name
    limit 4000
  ),
  heatmap_groups as (
    select
      (extract(isodow from (created_at at time zone p_timezone))::int - 1) as day,
      extract(hour from (created_at at time zone p_timezone))::int as hour,
      count(*)::int as count
    from volume_orders
    where created_at >= p_current_start
    group by 1, 2
  )
  select jsonb_build_object(
    'currentOrders', count(*) filter (where v.created_at >= p_current_start),
    'previousOrders', count(*) filter (where v.created_at < p_current_start),
    'currentSessions', count(distinct v.session_id) filter (
      where v.created_at >= p_current_start and v.session_id is not null
    ),
    'previousSessions', count(distinct v.session_id) filter (
      where v.created_at < p_current_start and v.session_id is not null
    ),
    'currentRevenue', coalesce((select sum(total) from collected_orders where paid_at >= p_current_start), 0),
    'previousRevenue', coalesce((select sum(total) from collected_orders where paid_at < p_current_start), 0),
    'currentPaidOrders', (select count(*) from collected_orders where paid_at >= p_current_start),
    'previousPaidOrders', (select count(*) from collected_orders where paid_at < p_current_start),
    'sales', coalesce((select jsonb_agg(jsonb_build_object(
      'period', period, 'day', day, 'hour', hour, 'total', total
    ) order by period, day, hour) from sales_groups), '[]'::jsonb),
    'heatmap', coalesce((select jsonb_agg(jsonb_build_object(
      'day', grids.day, 'hour', grids.hour, 'count', coalesce(h.count, 0)
    ) order by grids.day, grids.hour)
      from (
        select d.day, h.hour
        from generate_series(0, 6) d(day)
        cross join generate_series(0, 23) h(hour)
      ) grids
      left join heatmap_groups h using (day, hour)
    ), '[]'::jsonb),
    'productOverflow', (select value > 2000 from product_cardinality),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
      'period', period, 'name', name, 'count', count, 'revenue', revenue
    ) order by period, revenue desc, name) from bounded_products), '[]'::jsonb)
  )
  from volume_orders v;
$$;
