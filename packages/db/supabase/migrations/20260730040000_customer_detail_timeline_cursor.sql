-- Slice 3: deterministic customer timeline cursor and canonical collected spend.
-- Customer spend must follow the same paid, non-cancelled, non-comp policy as
-- every other collected-revenue projection.

do $migration$
declare
  fn regprocedure := 'public.get_restaurant_customers(uuid,uuid,text,text,text,integer,integer,jsonb)'::regprocedure;
  definition text;
  old_spend text := E'coalesce(sum(total) filter (where paid_at is not null and status <> \'cancelled\'), 0) as spend';
  new_spend text := E'coalesce(sum(total) filter (where paid_at is not null and status <> \'cancelled\' and (payment_method is null or payment_method <> \'comp\')), 0) as spend';
begin
  select pg_get_functiondef(fn) into definition;
  if position(new_spend in definition) = 0 then
    if position(old_spend in definition) = 0 then
      raise exception 'get_restaurant_customers spend predicate has unexpected shape';
    end if;
    execute replace(definition, old_spend, new_spend);
  end if;
end
$migration$;

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
        where paid_at is not null
          and status <> 'cancelled'
          and (payment_method is null or payment_method <> 'comp')
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

create index if not exists orders_customer_timeline_idx
  on public.orders (restaurant_id, customer_id, created_at desc, id desc)
  where customer_id is not null and deleted_at is null;

create index if not exists loyalty_transactions_customer_timeline_idx
  on public.loyalty_transactions (restaurant_id, customer_id, created_at desc, id desc);

create or replace function public.get_restaurant_customer_timeline(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_before_at timestamptz default null,
  p_before_kind text default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns table (
  event_id uuid,
  event_kind text,
  event_at timestamptz,
  amount numeric,
  status text,
  paid boolean,
  collected boolean,
  loyalty_type text,
  direction text,
  delta integer,
  reason text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with events as (
    select
      o.id as event_id,
      'order'::text as event_kind,
      0 as kind_order,
      o.created_at as event_at,
      o.total as amount,
      o.status,
      (o.paid_at is not null) as paid,
      (
        o.paid_at is not null
        and o.status <> 'cancelled'
        and (o.payment_method is null or o.payment_method <> 'comp')
      ) as collected,
      null::text as loyalty_type,
      null::text as direction,
      null::integer as delta,
      null::text as reason
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.customer_id = p_customer_id
      and o.deleted_at is null

    union all

    select
      ledger.id,
      'ledger'::text,
      1,
      ledger.created_at,
      null::numeric,
      null::text,
      null::boolean,
      null::boolean,
      ledger.type,
      ledger.direction,
      ledger.delta,
      ledger.reason
    from public.loyalty_transactions ledger
    where ledger.restaurant_id = p_restaurant_id
      and ledger.customer_id = p_customer_id
      and ledger.type in ('stamp', 'points', 'visit')
      and ledger.direction in ('earn', 'redeem', 'refund')
  ),
  bounded as (
    select *
    from events e
    where (
      p_before_at is null and p_before_kind is null and p_before_id is null
    ) or (
      p_before_at is not null
      and p_before_kind in ('order', 'ledger')
      and p_before_id is not null
      and (
        e.event_at < p_before_at
        or (
          e.event_at = p_before_at
          and (
            e.kind_order > case p_before_kind when 'order' then 0 else 1 end
            or (
              e.kind_order = case p_before_kind when 'order' then 0 else 1 end
              and e.event_id < p_before_id
            )
          )
        )
      )
    )
  )
  select
    event_id,
    event_kind,
    event_at,
    amount,
    status,
    paid,
    collected,
    loyalty_type,
    direction,
    delta,
    reason
  from bounded
  order by event_at desc, kind_order asc, event_id desc
  limit least(greatest(p_limit, 1), 100) + 1;
$$;

revoke all on function public.get_restaurant_customer_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_restaurant_customer_summary(uuid, uuid) to service_role;

revoke all on function public.get_restaurant_customer_timeline(uuid, uuid, timestamptz, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_restaurant_customer_timeline(uuid, uuid, timestamptz, text, uuid, integer) to service_role;

revoke all on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) to service_role;
