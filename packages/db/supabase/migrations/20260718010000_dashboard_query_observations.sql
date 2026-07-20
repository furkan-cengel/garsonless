-- Persistent operational sink for anomalous dashboard read-model queries.
-- Fast successful reads are never inserted; the application writes only
-- degraded, failed or slow observations through the service role.

create table public.dashboard_query_observations (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  operation text not null check (operation in (
    'order-volume',
    'collected-orders',
    'table-refs',
    'table-performance',
    'pano-operational'
  )),
  outcome text not null check (outcome in ('success', 'degraded', 'failure')),
  duration_ms integer not null check (duration_ms >= 0),
  issue_count integer not null default 0 check (issue_count >= 0),
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now()
);

create index dashboard_query_observations_restaurant_created_idx
  on public.dashboard_query_observations (restaurant_id, created_at desc);

create index dashboard_query_observations_outcome_created_idx
  on public.dashboard_query_observations (outcome, created_at desc)
  where outcome <> 'success';

alter table public.dashboard_query_observations enable row level security;

-- Deliberately no anon/authenticated policy. Only service-role infrastructure
-- can insert or inspect operational query observations.
revoke all on table public.dashboard_query_observations from anon, authenticated;
grant select, insert, delete on table public.dashboard_query_observations to service_role;
grant usage, select on sequence public.dashboard_query_observations_id_seq to service_role;
