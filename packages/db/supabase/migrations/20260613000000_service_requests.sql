-- Garson çağır (waiter call). Customers trigger via the menu API (service role);
-- the dashboard reads/resolves with the owner's authenticated session.
-- NO anon policies: customers never read these rows.

create table service_requests (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references restaurants(id) on delete cascade,
  table_id         uuid not null references tables(id) on delete cascade,
  table_session_id uuid references table_sessions(id) on delete set null,
  status           text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index service_requests_pending_idx
  on service_requests(restaurant_id) where status = 'pending';

alter table service_requests enable row level security;

create policy "owner_manage_service_requests" on service_requests
  for all to authenticated
  using (exists (
    select 1 from restaurants r
    where r.id = service_requests.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ))
  with check (exists (
    select 1 from restaurants r
    where r.id = service_requests.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ));

-- Dashboard realtime (postgres_changes respects RLS; owner session sees own rows).
alter publication supabase_realtime add table service_requests;
