-- Read-only figures for the redesigned stock overview. The dashboard reads them
-- right after a successful execute_inventory snapshot, which has already checked
-- the actor and the plan, so this function is service-role only and takes no actor.
--
-- Days are the restaurant's local calendar days. Consumption is what left stock
-- through sales and production inputs, net of cancellation returns.

create or replace function public.inventory_insights(p_restaurant uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tz as (
    select coalesce(nullif(r.timezone, ''), 'Europe/Istanbul') as zone
    from public.restaurants r
    where r.id = p_restaurant
  ),
  today as (
    select (clock_timestamp() at time zone tz.zone)::date as day, tz.zone from tz
  ),
  moves as (
    select m.item_id, m.quantity, m.cost, m.created_at, d.kind, d.reason, d.actor_label,
      (m.created_at at time zone t.zone)::date as day
    from public.inventory_movements m
    join public.inventory_documents d on d.id = m.document_id
    cross join today t
    where m.restaurant_id = p_restaurant
      and m.created_at >= clock_timestamp() - interval '15 days'
  ),
  consumption as (
    select mv.item_id, mv.day, sum(-mv.quantity) as used
    from moves mv
    where mv.kind in ('sale', 'external_sale', 'cancellation_return')
       or (mv.kind = 'production' and mv.quantity < 0)
    group by mv.item_id, mv.day
  ),
  receipts as (
    select m.item_id, m.created_at, m.quantity, m.cost,
      row_number() over (partition by m.item_id order by m.created_at desc, m.id desc) as rn
    from public.inventory_movements m
    join public.inventory_documents d on d.id = m.document_id
    where m.restaurant_id = p_restaurant and d.kind = 'receipt' and m.quantity > 0
  ),
  recent as (
    select m.item_id, m.created_at, m.quantity, d.kind, d.reason, d.actor_label,
      row_number() over (partition by m.item_id order by m.created_at desc, m.id desc) as rn
    from public.inventory_movements m
    join public.inventory_documents d on d.id = m.document_id
    where m.restaurant_id = p_restaurant
  )
  select jsonb_build_object(
    'today', (select day from today),
    'lastSaleAt', (
      select max(m.created_at) from public.inventory_movements m
      join public.inventory_documents d on d.id = m.document_id
      where m.restaurant_id = p_restaurant and d.kind = 'sale'
    ),
    'waste', jsonb_build_object(
      'thisWeek', (select coalesce(sum(abs(mv.quantity) * mv.cost), 0)::text from moves mv where mv.kind = 'waste' and mv.created_at >= clock_timestamp() - interval '7 days'),
      'lastWeek', (select coalesce(sum(abs(mv.quantity) * mv.cost), 0)::text from moves mv where mv.kind = 'waste' and mv.created_at >= clock_timestamp() - interval '14 days' and mv.created_at < clock_timestamp() - interval '7 days'),
      'missingCost', (select coalesce(bool_or(mv.cost is null), false) from moves mv where mv.kind = 'waste' and mv.created_at >= clock_timestamp() - interval '7 days')
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'itemId', i.id,
        'daily', (
          select jsonb_agg(coalesce(c.used, 0)::text order by g.day)
          from today t
          cross join lateral generate_series(t.day - 6, t.day, interval '1 day') as g(day)
          left join consumption c on c.item_id = i.id and c.day = g.day::date
        ),
        'lastReceipt', (
          select jsonb_build_object('at', r.created_at, 'quantity', r.quantity::text, 'cost', r.cost::text)
          from receipts r where r.item_id = i.id and r.rn = 1
        ),
        'previousReceiptCost', (select r.cost::text from receipts r where r.item_id = i.id and r.rn = 2),
        'recent', (
          select coalesce(jsonb_agg(jsonb_build_object('at', x.created_at, 'kind', x.kind, 'quantity', x.quantity::text, 'reason', x.reason, 'actor', x.actor_label) order by x.created_at desc), '[]')
          from recent x where x.item_id = i.id and x.rn <= 5
        )
      )), '[]')
      from public.inventory_items i
      where i.restaurant_id = p_restaurant and not i.archived
    )
  );
$$;

revoke all on function public.inventory_insights(uuid) from public, anon, authenticated;
grant execute on function public.inventory_insights(uuid) to service_role;
