-- Customer detail summary must cover the customer's full venue history while
-- the UI timeline remains intentionally capped. Service-role only: customer
-- PII/CRM data is protected by the dashboard's customers-section gate.

create or replace function public.get_restaurant_customer_summary(
  p_restaurant_id uuid,
  p_customer_id uuid
)
returns table (
  spend numeric,
  visits integer,
  first_seen timestamptz,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with order_summary as (
    select
      coalesce(sum(total) filter (
        where paid_at is not null and status <> 'cancelled'
      ), 0) as spend
    from public.orders
    where restaurant_id = p_restaurant_id
      and customer_id = p_customer_id
      and deleted_at is null
  ),
  visit_summary as (
    select coalesce(sum(delta) filter (where type = 'visit'), 0)::integer as visits
    from public.loyalty_transactions
    where restaurant_id = p_restaurant_id
      and customer_id = p_customer_id
  ),
  activity as (
    select created_at
    from public.orders
    where restaurant_id = p_restaurant_id
      and customer_id = p_customer_id
      and deleted_at is null
    union all
    select created_at
    from public.loyalty_transactions
    where restaurant_id = p_restaurant_id
      and customer_id = p_customer_id
  )
  select
    o.spend,
    v.visits,
    min(a.created_at) as first_seen,
    max(a.created_at) as last_seen
  from order_summary o
  cross join visit_summary v
  left join activity a on true
  group by o.spend, v.visits;
$$;

revoke all on function public.get_restaurant_customer_summary(uuid, uuid) from public;
revoke all on function public.get_restaurant_customer_summary(uuid, uuid) from anon, authenticated;
grant execute on function public.get_restaurant_customer_summary(uuid, uuid) to service_role;
