-- Fixed-size cancellation audit: period totals, current trend buckets and top
-- products are aggregated in SQL; individual order snapshots stay in Postgres.

create or replace function public.read_analytics_cancellation_aggregate(
  p_restaurant_id uuid,
  p_since timestamptz,
  p_current_start timestamptz,
  p_before timestamptz,
  p_timezone text,
  p_source text,
  p_payment_method text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filtered_orders as (
    select
      o.id,
      greatest(coalesce(o.total, 0), 0)::numeric as total,
      o.status,
      o.items,
      o.created_at,
      o.paid_at,
      o.payment_method
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_since
      and o.created_at < p_before
      and o.deleted_at is null
      and (p_source is null or o.source = p_source)
      and (
        p_payment_method is null
        or (p_payment_method = 'unknown' and o.payment_method is null)
        or (p_payment_method <> 'unknown' and o.payment_method = p_payment_method)
      )
  ),
  period_metrics as (
    select
      case when created_at >= p_current_start then 'current' else 'previous' end as period,
      count(*)::int as all_orders,
      count(*) filter (where status = 'cancelled')::int as cancelled_count,
      round(coalesce(sum(total) filter (
        where status = 'cancelled' and paid_at is null and payment_method is distinct from 'comp'
      ), 0), 2) as lost_amount,
      count(*) filter (
        where status = 'cancelled' and paid_at is not null and payment_method is distinct from 'comp'
      )::int as collected_count,
      round(coalesce(sum(total) filter (
        where status = 'cancelled' and paid_at is not null and payment_method is distinct from 'comp'
      ), 0), 2) as collected_amount,
      count(*) filter (where status = 'cancelled' and payment_method = 'comp')::int as comp_count,
      round(coalesce(sum(total) filter (where status = 'cancelled' and payment_method = 'comp'), 0), 2) as comp_amount
    from filtered_orders
    group by 1
  ),
  current_cancelled as (
    select * from filtered_orders where status = 'cancelled' and created_at >= p_current_start
  ),
  trend_groups as (
    select
      to_char(created_at at time zone p_timezone, 'YYYY-MM-DD') as day,
      extract(hour from (created_at at time zone p_timezone))::int as hour,
      count(*)::int as count
    from current_cancelled
    group by 1, 2
  ),
  item_lines as (
    select
      o.id as order_id,
      o.total as order_total,
      item.ordinality,
      coalesce(nullif(btrim(item.value ->> 'name'), ''), 'Ürün') as name,
      case
        when jsonb_typeof(coalesce(item.value -> 'quantity', item.value -> 'qty')) = 'number'
          and coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric > 0
          then coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric
        else 1
      end as quantity,
      round(greatest(
        coalesce(case when jsonb_typeof(item.value -> 'price') = 'number'
          then (item.value ->> 'price')::numeric end, 0)
        + coalesce(case when jsonb_typeof(item.value -> 'modifiersPriceDelta') = 'number'
          then (item.value ->> 'modifiersPriceDelta')::numeric end, 0),
        0
      ) * case
        when jsonb_typeof(coalesce(item.value -> 'quantity', item.value -> 'qty')) = 'number'
          and coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric > 0
          then coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric
        else 1
      end, 2) as line_gross
    from current_cancelled o
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
    ) with ordinality as item(value, ordinality)
  ),
  allocated_base as (
    select
      lines.*,
      sum(line_gross) over (partition by order_id) as line_total,
      row_number() over (partition by order_id order by line_gross desc, ordinality) as gross_rank
    from item_lines lines
  ),
  allocated_round as (
    select
      base.*,
      round(line_gross * least(order_total, line_total) / nullif(line_total, 0), 2) as allocated,
      least(order_total, line_total) as product_target
    from allocated_base base
    where line_total > 0
  ),
  allocated_lines as (
    select
      name,
      quantity,
      allocated + case when gross_rank = 1 then
        round(product_target - sum(allocated) over (partition by order_id), 2)
      else 0 end as revenue
    from allocated_round
  ),
  top_items as (
    select name, sum(quantity)::numeric as count, round(sum(revenue), 2) as revenue
    from allocated_lines
    group by name
    order by count desc, revenue desc, name
    limit 5
  )
  select jsonb_build_object(
    'current', coalesce((select jsonb_build_object(
      'allOrders', all_orders,
      'cancelledCount', cancelled_count,
      'lostAmount', lost_amount,
      'collectedCancelledCount', collected_count,
      'collectedCancelledAmount', collected_amount,
      'compCancelledCount', comp_count,
      'compCancelledAmount', comp_amount
    ) from period_metrics where period = 'current'), jsonb_build_object(
      'allOrders', 0, 'cancelledCount', 0, 'lostAmount', 0,
      'collectedCancelledCount', 0, 'collectedCancelledAmount', 0,
      'compCancelledCount', 0, 'compCancelledAmount', 0
    )),
    'previous', coalesce((select jsonb_build_object(
      'allOrders', all_orders, 'cancelledCount', cancelled_count, 'lostAmount', lost_amount
    ) from period_metrics where period = 'previous'), jsonb_build_object(
      'allOrders', 0, 'cancelledCount', 0, 'lostAmount', 0
    )),
    'topItems', coalesce((select jsonb_agg(jsonb_build_object(
      'name', name, 'count', count, 'revenue', revenue
    ) order by count desc, revenue desc, name) from top_items), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day, 'hour', hour, 'count', count
    ) order by day, hour) from trend_groups), '[]'::jsonb)
  );
$$;

revoke all on function public.read_analytics_cancellation_aggregate(
  uuid, timestamptz, timestamptz, timestamptz, text, text, text
) from public, anon, authenticated;
grant execute on function public.read_analytics_cancellation_aggregate(
  uuid, timestamptz, timestamptz, timestamptz, text, text, text
) to service_role;
