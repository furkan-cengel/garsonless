-- Sprint 16a — Müşteriler (Customers CRM). PII + money (points), so isolation
-- discipline mirrors customers/payment_credentials: the new consent table is
-- service-role only, and the owner-scoped list aggregator is a security-definer
-- function REVOKED from anon/authenticated (callable only via the service role,
-- after the dashboard action validates restaurant ownership).

-- ════════════════════════════════════════════════════════════════════════════
-- KVKK consent — PER-RESTAURANT (each işletme is a separate veri sorumlusu, so
-- consent to venue A must never expose the customer to venue B). Service-role
-- only; owners read consent indirectly via the masked-phone logic.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists customer_consents (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  consent_type  text not null default 'contact_data'
                check (consent_type in ('contact_data', 'marketing')),
  granted_at    timestamptz,
  revoked_at    timestamptz,
  source        text,                       -- 'join' | 'member_sheet' (audit)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (customer_id, restaurant_id, consent_type)
);

alter table customer_consents enable row level security;
-- Deliberately NO policies → service-role only (same discipline as customers).

create trigger customer_consents_updated_at
  before update on customer_consents
  for each row execute function update_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Audit: which owner/user granted a manual ledger row (store credit). Only set
-- on manual grants; earn/redeem/visit/welcome rows leave it null.
-- ════════════════════════════════════════════════════════════════════════════
alter table loyalty_transactions
  add column if not exists granted_by uuid references auth.users(id) on delete set null;

-- ════════════════════════════════════════════════════════════════════════════
-- Owner-scoped customer list aggregator. ISOLATION: every aggregate is hard
-- filtered by p_restaurant_id (spend/visits/candidate set) or p_scope_key
-- (points balance). The caller (a dashboard server action) validates that the
-- authed owner owns p_restaurant_id BEFORE invoking this via the service role.
--   • spend  = PAID-ONLY (paid_at not null, non-cancelled) — money collected
--   • visits = Σ visit delta at the venue
--   • points = Σ points delta at scope_key (spendable); lifetime = Σ earn
-- ════════════════════════════════════════════════════════════════════════════
create or replace function get_restaurant_customers(
  p_restaurant_id uuid,
  p_scope_key     uuid,
  p_search        text default null,
  p_sort          text default 'last_seen',
  p_segment       text default null,
  p_limit         int  default 50,
  p_offset        int  default 0
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

revoke execute on function get_restaurant_customers(uuid, uuid, text, text, text, int, int) from public;
revoke execute on function get_restaurant_customers(uuid, uuid, text, text, text, int, int) from anon, authenticated;
