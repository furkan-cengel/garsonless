-- Analytics financial policy and narrow freshness boundary.
-- A paid order remains part of gross collection even if its later lifecycle
-- state is cancelled; successful refunds are accounted for separately.

do $migration$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(proc.oid)
    into function_definition
  from pg_proc proc
  join pg_namespace namespace on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and proc.proname = 'read_analytics_core_metrics'
    and pg_get_function_identity_arguments(proc.oid) =
      'p_restaurant_id uuid, p_since timestamp with time zone, p_current_start timestamp with time zone, p_before timestamp with time zone, p_timezone text, p_source text, p_payment_method text, p_status text';

  if function_definition is null then
    raise exception 'read_analytics_core_metrics was not found';
  end if;

  corrected_definition := replace(
    function_definition,
    E'and o.deleted_at is null\n      and o.status <> ''cancelled''\n      and (o.payment_method is null or o.payment_method <> ''comp'')',
    E'and o.deleted_at is null\n      and (o.payment_method is null or o.payment_method <> ''comp'')'
  );

  if corrected_definition = function_definition then
    raise exception 'analytics collected-order policy replacement did not match';
  end if;

  execute corrected_definition;
end
$migration$;

revoke all on function public.read_analytics_core_metrics(
  uuid, timestamptz, timestamptz, timestamptz, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.read_analytics_core_metrics(
  uuid, timestamptz, timestamptz, timestamptz, text, text, text, text
) to service_role;

create or replace function public.read_analytics_table_performance(
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
  with live_tables as (
    select t.id, t.label, t.created_at
    from public.tables t
    where t.restaurant_id = p_restaurant_id
      and t.deleted_at is null
  ),
  order_groups as (
    select
      o.table_id,
      round(sum(coalesce(o.total, 0))::numeric, 2) as total,
      count(*)::int as count
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.table_id is not null
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
    group by o.table_id
  ),
  session_groups as (
    select
      s.table_id,
      count(*)::int as turnover,
      round(sum(extract(epoch from (s.closed_at - s.opened_at)) / 60.0)::numeric, 2) as dwell_sum_minutes
    from public.table_sessions s
    where s.restaurant_id = p_restaurant_id
      and s.closed_at is not null
      and s.closed_at >= p_since
      and s.closed_at < p_before
      and s.closed_at >= s.opened_at
    group by s.table_id
  ),
  open_tables as (
    select distinct s.table_id
    from public.table_sessions s
    where s.restaurant_id = p_restaurant_id
      and s.closed_at is null
  )
  select jsonb_build_object(
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'label', t.label
    ) order by t.created_at) from live_tables t), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
      'tableId', o.table_id, 'total', o.total, 'count', o.count
    ) order by o.table_id) from order_groups o), '[]'::jsonb),
    'closedSessions', coalesce((select jsonb_agg(jsonb_build_object(
      'tableId', s.table_id,
      'turnover', s.turnover,
      'dwellSumMinutes', s.dwell_sum_minutes
    ) order by s.table_id) from session_groups s), '[]'::jsonb),
    'openTableIds', coalesce((select jsonb_agg(o.table_id order by o.table_id) from open_tables o), '[]'::jsonb)
  );
$$;

revoke all on function public.read_analytics_table_performance(
  uuid, timestamptz, timestamptz, text, text, text
) from public, anon, authenticated;
grant execute on function public.read_analytics_table_performance(
  uuid, timestamptz, timestamptz, text, text, text
) to service_role;

create index if not exists orders_analytics_active_count_idx
  on public.orders (restaurant_id, status)
  where deleted_at is null
    and status in ('pending_approval', 'pending', 'preparing', 'ready');

drop policy if exists pano_invalidations_read on public.pano_invalidations;
create policy pano_invalidations_read on public.pano_invalidations
  for select to authenticated
  using (
    public.has_restaurant_section(restaurant_id, 'pano')
    or public.has_restaurant_section(restaurant_id, 'tables')
    or public.has_restaurant_section(restaurant_id, 'orders')
    or public.has_restaurant_section(restaurant_id, 'analytics')
  );
