-- Explicit customer ↔ restaurant association. A global auth-linked customer
-- must never appear in every tenant's CRM merely because auth_user_id is set.

create table public.customer_restaurants (
  customer_id uuid not null references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source text not null check (source in ('auth', 'activity', 'consent')),
  linked_at timestamptz not null default now(),
  primary key (customer_id, restaurant_id)
);

create index customer_restaurants_restaurant_idx
  on public.customer_restaurants (restaurant_id, linked_at desc);

alter table public.customer_restaurants enable row level security;
revoke all on table public.customer_restaurants from public, anon, authenticated;

insert into public.customer_restaurants (customer_id, restaurant_id, source, linked_at)
select customer_id, restaurant_id, 'activity', min(created_at)
from (
  select customer_id, restaurant_id, created_at
  from public.orders
  where customer_id is not null and deleted_at is null
  union all
  select customer_id, restaurant_id, created_at
  from public.loyalty_transactions
) activity
group by customer_id, restaurant_id
on conflict (customer_id, restaurant_id) do nothing;

insert into public.customer_restaurants (customer_id, restaurant_id, source, linked_at)
select customer_id, restaurant_id, 'consent', coalesce(granted_at, revoked_at, now())
from public.customer_consents
on conflict (customer_id, restaurant_id) do nothing;

-- The CRM aggregate's return type and predicates stay unchanged. Extend only
-- its canonical candidate CTE from the known migration lineage.
do $migration$
declare
  fn regprocedure := 'public.get_restaurant_customers(uuid,uuid,text,text,text,integer,integer,jsonb)'::regprocedure;
  definition text;
  old_fragment text := E'    select distinct customer_id as cid\n      from loyalty_transactions\n      where restaurant_id = p_restaurant_id\n  ),';
  new_fragment text := E'    select distinct customer_id as cid\n      from loyalty_transactions\n      where restaurant_id = p_restaurant_id\n    union\n    select customer_id as cid\n      from customer_restaurants\n      where restaurant_id = p_restaurant_id\n  ),';
begin
  select pg_get_functiondef(fn) into definition;
  if position(new_fragment in definition) > 0 then
    return;
  end if;
  if position(old_fragment in definition) = 0 then
    raise exception 'get_restaurant_customers candidate CTE has unexpected shape';
  end if;
  execute replace(definition, old_fragment, new_fragment);
end
$migration$;

revoke execute on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) from public;
revoke execute on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) from anon, authenticated;
