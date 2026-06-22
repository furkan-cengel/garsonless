-- Sprint 16b — saved/custom CRM customer segments.
-- Segment definitions are restaurant-owned JSON predicates evaluated inside the
-- owner-scoped customer aggregate. The aggregate keeps venue metrics scoped by
-- restaurant_id and points/lifetime scoped by loyalty scope_key.

create table if not exists public.customer_segments (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  definition    jsonb not null default '{}'::jsonb check (jsonb_typeof(definition) = 'object'),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists customer_segments_restaurant_idx
  on public.customer_segments(restaurant_id)
  where deleted_at is null;

create trigger customer_segments_updated_at
  before update on public.customer_segments
  for each row execute function public.update_updated_at();

alter table public.customer_segments enable row level security;

drop policy if exists "owner_manage_customer_segments" on public.customer_segments;
create policy "owner_manage_customer_segments" on public.customer_segments
  for all to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = customer_segments.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ))
  with check (exists (
    select 1 from public.restaurants r
    where r.id = customer_segments.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ));

drop function if exists public.get_restaurant_customers(uuid, uuid, text, text, text, int, int);

create or replace function public.get_restaurant_customers(
  p_restaurant_id  uuid,
  p_scope_key      uuid,
  p_search         text default null,
  p_sort           text default 'last_seen',
  p_segment        text default null,
  p_limit          int  default 50,
  p_offset         int  default 0,
  p_custom_segment jsonb default null
) returns table (
  customer_id     uuid,
  name            text,
  phone           text,
  has_consent     boolean,
  spend           numeric,
  visits          int,
  points          int,
  lifetime_points int,
  last_seen       timestamptz,
  first_seen      timestamptz,
  total_count     bigint
)
language sql
security definer
set search_path = public
as $$
  with cand as (
    select distinct customer_id as cid
      from orders
      where restaurant_id = p_restaurant_id and customer_id is not null and deleted_at is null
    union
    select distinct customer_id as cid
      from loyalty_transactions
      where restaurant_id = p_restaurant_id
  ),
  ord as (
    select customer_id as cid,
           coalesce(sum(total) filter (where paid_at is not null and status <> 'cancelled'), 0) as spend,
           max(created_at) as last_o,
           min(created_at) as first_o
      from orders
      where restaurant_id = p_restaurant_id and customer_id is not null and deleted_at is null
      group by customer_id
  ),
  vis as (
    select customer_id as cid,
           coalesce(sum(delta) filter (where type = 'visit'), 0)::int as visits,
           max(created_at) as last_l,
           min(created_at) as first_l
      from loyalty_transactions
      where restaurant_id = p_restaurant_id
      group by customer_id
  ),
  pts as (
    select customer_id as cid,
           coalesce(sum(delta) filter (where type = 'points'), 0)::int as points,
           coalesce(sum(delta) filter (where type = 'points' and direction = 'earn'), 0)::int as lifetime
      from loyalty_transactions
      where scope_key = p_scope_key
      group by customer_id
  ),
  base as (
    select
      cand.cid as customer_id,
      cu.name,
      cu.phone,
      exists (
        select 1 from customer_consents cc
        where cc.customer_id = cand.cid and cc.restaurant_id = p_restaurant_id
          and cc.consent_type = 'contact_data'
          and cc.granted_at is not null and cc.revoked_at is null
      ) as has_consent,
      coalesce(ord.spend, 0) as spend,
      coalesce(vis.visits, 0) as visits,
      coalesce(pts.points, 0) as points,
      coalesce(pts.lifetime, 0) as lifetime_points,
      greatest(ord.last_o, vis.last_l) as last_seen,
      least(ord.first_o, vis.first_l) as first_seen
    from cand
    join customers cu on cu.id = cand.cid
    left join ord on ord.cid = cand.cid
    left join vis on vis.cid = cand.cid
    left join pts on pts.cid = cand.cid
  ),
  filtered as (
    select * from base
    where (p_search is null or p_search = ''
           or lower(name) like '%' || lower(p_search) || '%'
           or phone like '%' || p_search)
      and (p_segment is null or p_segment = ''
           or (p_segment = 'new'       and first_seen > now() - interval '30 days')
           or (p_segment = 'frequent'  and visits >= 3)
           or (p_segment = 'lapsed'    and last_seen < now() - interval '60 days')
           or (p_segment = 'consented' and has_consent))
      and (
        p_custom_segment is null
        or jsonb_typeof(p_custom_segment) <> 'object'
        or p_custom_segment = '{}'::jsonb
        or (
          (
            not (p_custom_segment ? 'consent')
            or (p_custom_segment->>'consent' = 'granted' and has_consent)
            or (p_custom_segment->>'consent' = 'missing' and not has_consent)
            or (p_custom_segment->>'consent' not in ('granted', 'missing'))
          )
          and (
            not (p_custom_segment ? 'last_seen_days')
            or case
              when (p_custom_segment #>> '{last_seen_days,op}') = '<='
                and coalesce((p_custom_segment #>> '{last_seen_days,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then last_seen is not null
                and last_seen >= now() - make_interval(days => floor((p_custom_segment #>> '{last_seen_days,value}')::numeric)::int)
              when (p_custom_segment #>> '{last_seen_days,op}') = '>='
                and coalesce((p_custom_segment #>> '{last_seen_days,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then last_seen is not null
                and last_seen <= now() - make_interval(days => floor((p_custom_segment #>> '{last_seen_days,value}')::numeric)::int)
              else true
            end
          )
          and (
            not (p_custom_segment ? 'visits')
            or case
              when (p_custom_segment #>> '{visits,op}') = '>='
                and coalesce((p_custom_segment #>> '{visits,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then visits >= floor((p_custom_segment #>> '{visits,value}')::numeric)::int
              when (p_custom_segment #>> '{visits,op}') = '<='
                and coalesce((p_custom_segment #>> '{visits,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then visits <= floor((p_custom_segment #>> '{visits,value}')::numeric)::int
              else true
            end
          )
          and (
            not (p_custom_segment ? 'spend')
            or case
              when (p_custom_segment #>> '{spend,op}') = '>='
                and coalesce((p_custom_segment #>> '{spend,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then spend >= (p_custom_segment #>> '{spend,value}')::numeric
              when (p_custom_segment #>> '{spend,op}') = '<='
                and coalesce((p_custom_segment #>> '{spend,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then spend <= (p_custom_segment #>> '{spend,value}')::numeric
              else true
            end
          )
          and (
            not (p_custom_segment ? 'points')
            or case
              when (p_custom_segment #>> '{points,op}') = '>='
                and coalesce((p_custom_segment #>> '{points,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then points >= floor((p_custom_segment #>> '{points,value}')::numeric)::int
              when (p_custom_segment #>> '{points,op}') = '<='
                and coalesce((p_custom_segment #>> '{points,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then points <= floor((p_custom_segment #>> '{points,value}')::numeric)::int
              else true
            end
          )
          and (
            not (p_custom_segment ? 'lifetime_points')
            or case
              when (p_custom_segment #>> '{lifetime_points,op}') = '>='
                and coalesce((p_custom_segment #>> '{lifetime_points,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then lifetime_points >= floor((p_custom_segment #>> '{lifetime_points,value}')::numeric)::int
              when (p_custom_segment #>> '{lifetime_points,op}') = '<='
                and coalesce((p_custom_segment #>> '{lifetime_points,value}') ~ '^[0-9]+(\.[0-9]+)?$', false)
              then lifetime_points <= floor((p_custom_segment #>> '{lifetime_points,value}')::numeric)::int
              else true
            end
          )
        )
      )
  )
  select
    customer_id, name, phone, has_consent, spend, visits, points, lifetime_points,
    last_seen, first_seen,
    count(*) over () as total_count
  from filtered
  order by
    case when p_sort = 'spend'  then spend       end desc nulls last,
    case when p_sort = 'visits' then visits      end desc nulls last,
    case when p_sort = 'points' then points      end desc nulls last,
    case when p_sort = 'joined' then first_seen  end desc nulls last,
    case when p_sort is null or p_sort = 'last_seen' then last_seen end desc nulls last,
    last_seen desc nulls last
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

revoke execute on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) from public;
revoke execute on function public.get_restaurant_customers(uuid, uuid, text, text, text, int, int, jsonb) from anon, authenticated;
