-- Bounded operation analytics. Staff payments are grouped in SQL and
-- abnormal-close detail is reduced to one row per session with an explicit cap.

create or replace function public.read_analytics_staff_settlement_aggregate(
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
  with grouped as (
    select
      o.settled_by,
      round(sum(case when o.payment_method = 'cash' then coalesce(o.total, 0) else 0 end), 2) as cash,
      round(sum(case when o.payment_method = 'pos' then coalesce(o.total, 0) else 0 end), 2) as pos,
      round(sum(case when o.payment_method = 'comp' then 0 else
        case when o.payment_method not in ('cash', 'pos') or o.payment_method is null
          then coalesce(o.total, 0) else 0 end end), 2) as other_collected,
      round(sum(case when o.payment_method = 'comp' then coalesce(o.total, 0) else 0 end), 2) as comp_amount,
      count(*) filter (where o.payment_method = 'comp')::int as comp_count,
      count(*)::int as settled_count
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.paid_at >= p_since
      and o.paid_at < p_before
      and o.deleted_at is null
      and o.status <> 'cancelled'
      and (p_source is null or o.source = p_source)
      and (p_status is null or o.status = p_status)
      and (
        p_payment_method is null
        or (p_payment_method = 'unknown' and o.payment_method is null)
        or (p_payment_method <> 'unknown' and o.payment_method = p_payment_method)
      )
    group by o.settled_by
  )
  select jsonb_build_object(
    'groups', coalesce(jsonb_agg(jsonb_build_object(
      'settledBy', settled_by,
      'cash', cash,
      'pos', pos,
      'otherCollected', other_collected,
      'compAmount', comp_amount,
      'compCount', comp_count,
      'settledCount', settled_count
    ) order by cash + pos + other_collected desc), '[]'::jsonb)
  )
  from grouped;
$$;

revoke all on function public.read_analytics_staff_settlement_aggregate(
  uuid, timestamptz, timestamptz, text, text, text
) from public, anon, authenticated;
grant execute on function public.read_analytics_staff_settlement_aggregate(
  uuid, timestamptz, timestamptz, text, text, text
) to service_role;

create or replace function public.read_analytics_abnormal_close_aggregate(
  p_restaurant_id uuid,
  p_since timestamptz,
  p_before timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with abnormal_sessions as (
    select
      s.id,
      s.table_id,
      s.closed_at,
      s.close_reason,
      coalesce(t.label, 'Masa') as table_label,
      round(coalesce(sum(o.total) filter (
        where o.paid_at is null and o.status <> 'cancelled' and o.deleted_at is null
      ), 0), 2) as unpaid_total
    from public.table_sessions s
    left join public.tables t
      on t.id = s.table_id and t.restaurant_id = s.restaurant_id
    left join public.orders o
      on o.table_session_id = s.id and o.restaurant_id = s.restaurant_id
    where s.restaurant_id = p_restaurant_id
      and s.close_reason is not null
      and s.close_reason <> 'auto'
      and s.closed_at is not null
      and s.closed_at >= p_since
      and s.closed_at < p_before
    group by s.id, s.table_id, s.closed_at, s.close_reason, t.label
  ),
  bounded as (
    select * from abnormal_sessions order by closed_at desc limit 501
  )
  select jsonb_build_object(
    'overflow', (select count(*) > 500 from bounded),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'tableId', table_id,
      'closedAt', closed_at,
      'closeReason', close_reason,
      'tableLabel', table_label,
      'unpaidTotal', unpaid_total
    ) order by closed_at desc) from (select * from bounded limit 500) rows), '[]'::jsonb)
  );
$$;

revoke all on function public.read_analytics_abnormal_close_aggregate(
  uuid, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.read_analytics_abnormal_close_aggregate(
  uuid, timestamptz, timestamptz
) to service_role;
