-- Fixed-size payment analytics. Money groups, VAT/discount summary and refund
-- groups are computed in PostgreSQL; individual orders never cross PostgREST.

create or replace function public.read_analytics_payment_aggregate(
  p_restaurant_id uuid,
  p_since timestamptz,
  p_before timestamptz,
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
  with paid_orders as (
    select
      o.id,
      greatest(coalesce(o.total, 0), 0)::numeric as total,
      o.payment_method,
      o.items
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.paid_at >= p_since
      and o.paid_at < p_before
      and o.deleted_at is null
      and (p_source is null or o.source = p_source)
      and (p_status is null or o.status = p_status)
      and (
        p_payment_method is null
        or (p_payment_method = 'unknown' and o.payment_method is null)
        or (p_payment_method <> 'unknown' and o.payment_method = p_payment_method)
      )
  ),
  payment_groups as (
    select payment_method, round(sum(total), 2) as amount, count(*)::int as count
    from paid_orders
    group by payment_method
  ),
  collected_orders as (
    select * from paid_orders where payment_method is null or payment_method <> 'comp'
  ),
  item_lines as (
    select
      o.id as order_id,
      o.total as order_total,
      round(greatest(
        coalesce(case when jsonb_typeof(item.value -> 'price') = 'number'
          then (item.value ->> 'price')::numeric end, 0)
        + coalesce(case when jsonb_typeof(item.value -> 'modifiersPriceDelta') = 'number'
          then (item.value ->> 'modifiersPriceDelta')::numeric end, 0),
        0
      ) * case
        when jsonb_typeof(coalesce(item.value -> 'quantity', item.value -> 'qty')) = 'number'
          and coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric > 0
          then greatest(1, floor(coalesce(item.value ->> 'quantity', item.value ->> 'qty')::numeric))
        else 1
      end, 2) as line_gross,
      case
        when jsonb_typeof(item.value -> 'vatRate') = 'number'
          and (item.value ->> 'vatRate')::numeric between 0 and 100
          then round((item.value ->> 'vatRate')::numeric, 2)
        else null
      end as vat_rate
    from collected_orders o
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
    ) as item(value)
  ),
  order_line_totals as (
    select order_id, max(order_total) as order_total, round(sum(line_gross), 2) as line_total
    from item_lines
    group by order_id
  ),
  gross_buckets as (
    select order_id, vat_rate, round(sum(line_gross), 2) as bucket_gross
    from item_lines
    group by order_id, vat_rate
  ),
  effective_buckets as (
    select
      b.order_id,
      b.vat_rate,
      case
        when totals.line_total > 0 and totals.order_total < totals.line_total
          then round(b.bucket_gross * totals.order_total / totals.line_total, 2)
        else b.bucket_gross
      end as effective_gross
    from gross_buckets b
    join order_line_totals totals using (order_id)
  ),
  bucket_financials as (
    select
      order_id,
      round(sum(case when vat_rate is null then effective_gross else 0 end), 2) as unknown_gross,
      round(sum(case when vat_rate is not null
        then effective_gross * vat_rate / (100 + vat_rate) else 0 end), 2) as vat_total,
      round(sum(case when vat_rate is not null
        then effective_gross - (effective_gross * vat_rate / (100 + vat_rate)) else 0 end), 2) as net_of_vat
    from effective_buckets
    group by order_id
  ),
  order_financials as (
    select
      o.id,
      o.total,
      coalesce(t.line_total, 0) as line_total,
      greatest(coalesce(t.line_total, 0) - o.total, 0) as discount_total,
      greatest(o.total - coalesce(t.line_total, 0), 0) as unattributed,
      coalesce(f.unknown_gross, 0) as unknown_gross,
      coalesce(f.vat_total, 0) as vat_total,
      coalesce(f.net_of_vat, 0) as net_of_vat
    from collected_orders o
    left join order_line_totals t on t.order_id = o.id
    left join bucket_financials f on f.order_id = o.id
  ),
  financial_summary as (
    select
      round(coalesce(sum(line_total), 0), 2) as gross_sales,
      round(coalesce(sum(discount_total), 0), 2) as discount_total,
      round(coalesce(sum(total), 0), 2) as net_sales,
      round(coalesce(sum(vat_total), 0), 2) as vat_total,
      round(coalesce(sum(net_of_vat), 0), 2) as net_of_vat_total,
      round(coalesce(sum(unknown_gross), 0), 2) as unknown_vat_gross,
      round(coalesce(sum(unattributed), 0), 2) as unattributed_amount
    from order_financials
  ),
  successful_refunds as (
    select r.amount::numeric as amount, r.payment_method, r.kind
    from public.order_refunds r
    join public.orders o
      on o.id = r.order_id and o.restaurant_id = r.restaurant_id
    where r.restaurant_id = p_restaurant_id
      and r.status = 'succeeded'
      and r.refunded_at >= p_since
      and r.refunded_at < p_before
      and r.payment_method in ('cash', 'pos', 'iyzico')
      and (p_source is null or o.source = p_source)
      and (p_status is null or o.status = p_status)
      and (
        p_payment_method is null
        or p_payment_method = r.payment_method
      )
  ),
  refund_groups as (
    select payment_method, round(sum(amount), 2) as amount, count(*)::int as count
    from successful_refunds
    group by payment_method
  ),
  refund_summary as (
    select
      round(coalesce(sum(amount), 0), 2) as total,
      count(*)::int as count,
      count(*) filter (where kind = 'full')::int as full_count,
      count(*) filter (where kind = 'partial')::int as partial_count
    from successful_refunds
  )
  select jsonb_build_object(
    'groups', coalesce((select jsonb_agg(jsonb_build_object(
      'paymentMethod', payment_method, 'amount', amount, 'count', count
    ) order by amount desc, payment_method) from payment_groups), '[]'::jsonb),
    'financials', (select jsonb_build_object(
      'grossSales', gross_sales,
      'discountTotal', discount_total,
      'netSales', net_sales,
      'vatTotal', vat_total,
      'netOfVatTotal', net_of_vat_total,
      'unknownVatGross', unknown_vat_gross,
      'unattributedAmount', unattributed_amount
    ) from financial_summary),
    'refunds', (select jsonb_build_object(
      'total', total,
      'count', count,
      'fullCount', full_count,
      'partialCount', partial_count,
      'groups', coalesce((select jsonb_agg(jsonb_build_object(
        'paymentMethod', payment_method, 'amount', amount, 'count', count
      ) order by amount desc, payment_method) from refund_groups), '[]'::jsonb)
    ) from refund_summary)
  );
$$;

revoke all on function public.read_analytics_payment_aggregate(
  uuid, timestamptz, timestamptz, text, text, text
) from public, anon, authenticated;
grant execute on function public.read_analytics_payment_aggregate(
  uuid, timestamptz, timestamptz, text, text, text
) to service_role;
