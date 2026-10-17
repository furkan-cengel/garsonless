-- Customer visits = distinct bills (table sessions) the customer ordered in.
--
-- Visits used to be read from loyalty_transactions rows of type 'visit', which
-- the outbox only writes when staff close a bill normally. Bills closed by the
-- idle sweep or with a reason never counted, so the CRM showed 0 visits next
-- to real spend. A visit is now any bill with at least one non-cancelled order
-- by the customer; an order without a table session (counter sale) is its own
-- visit. Loyalty 'visit' rows stay untouched for earning rules.

-- 1. Customer list (get_restaurant_customers): patched in place like earlier
--    slices, because its body has been amended by several migrations.
do $migration$
declare
  fn regprocedure := 'public.get_restaurant_customers(uuid,uuid,text,text,text,integer,integer,jsonb)'::regprocedure;
  definition text;
  old_ord text := E'max(created_at) as last_o,';
  new_ord text := E'count(distinct coalesce(table_session_id, id)) filter (where status <> \'cancelled\')::int as visits,\n           max(created_at) as last_o,';
  old_visits text := E'coalesce(vis.visits, 0) as visits,';
  new_visits text := E'coalesce(ord.visits, 0) as visits,';
begin
  select pg_get_functiondef(fn) into definition;
  if position(new_visits in definition) > 0 then
    return;
  end if;
  if position(old_ord in definition) = 0 or position(old_visits in definition) = 0 then
    raise exception 'get_restaurant_customers visit projection has unexpected shape';
  end if;
  if (length(definition) - length(replace(definition, old_ord, ''))) / length(old_ord) <> 1 then
    raise exception 'get_restaurant_customers order aggregate is ambiguous';
  end if;
  definition := replace(definition, old_ord, new_ord);
  definition := replace(definition, old_visits, new_visits);
  execute definition;
end
$migration$;

-- 2. Customer detail summary: same definition.
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
set search_path = public, pg_temp
as $$
  with order_summary as (
    select
      coalesce(sum(total) filter (
        where paid_at is not null
          and status <> 'cancelled'
          and (payment_method is null or payment_method <> 'comp')
      ), 0) as spend,
      count(distinct coalesce(table_session_id, id)) filter (where status <> 'cancelled')::integer as visits
    from public.orders
    where restaurant_id = p_restaurant_id
      and customer_id = p_customer_id
      and deleted_at is null
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
    o.visits,
    min(a.created_at) as first_seen,
    max(a.created_at) as last_seen
  from order_summary o
  left join activity a on true
  group by o.spend, o.visits;
$$;

revoke all on function public.get_restaurant_customer_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_restaurant_customer_summary(uuid, uuid) to service_role;
