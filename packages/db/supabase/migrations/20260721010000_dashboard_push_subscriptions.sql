-- Durable dashboard Web Push subscriptions and per-event delivery receipts.
-- Browser users may manage only their own subscriptions for restaurants they
-- can access. Delivery attempts are service-role only because they expose
-- provider diagnostics and form the outbox consumer's idempotency boundary.

create table public.dashboard_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  endpoint_hash text not null check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id, endpoint_hash)
);

create index dashboard_push_subscriptions_active_restaurant_idx
  on public.dashboard_push_subscriptions(restaurant_id, user_id)
  where disabled_at is null;

create table public.dashboard_push_deliveries (
  outbox_id uuid not null references public.domain_outbox(id) on delete cascade,
  subscription_id uuid not null references public.dashboard_push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'gone', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (outbox_id, subscription_id)
);

create index dashboard_push_deliveries_status_idx
  on public.dashboard_push_deliveries(status, updated_at)
  where status in ('pending', 'failed');

alter table public.dashboard_push_subscriptions enable row level security;
alter table public.dashboard_push_deliveries enable row level security;

revoke all on public.dashboard_push_subscriptions from public, anon, authenticated;
revoke all on public.dashboard_push_deliveries from public, anon, authenticated;

grant select, insert, update, delete on public.dashboard_push_subscriptions to authenticated;

create policy dashboard_push_subscriptions_select_own
  on public.dashboard_push_subscriptions
  for select to authenticated
  using (
    user_id = auth.uid()
    and public.has_restaurant_access(restaurant_id)
  );

create policy dashboard_push_subscriptions_insert_own
  on public.dashboard_push_subscriptions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_restaurant_access(restaurant_id)
  );

create policy dashboard_push_subscriptions_update_own
  on public.dashboard_push_subscriptions
  for update to authenticated
  using (
    user_id = auth.uid()
    and public.has_restaurant_access(restaurant_id)
  )
  with check (
    user_id = auth.uid()
    and public.has_restaurant_access(restaurant_id)
  );

create policy dashboard_push_subscriptions_delete_own
  on public.dashboard_push_subscriptions
  for delete to authenticated
  using (
    user_id = auth.uid()
    and public.has_restaurant_access(restaurant_id)
  );

comment on table public.dashboard_push_subscriptions is
  'Tenant-scoped Web Push endpoints owned by authenticated dashboard users.';
comment on table public.dashboard_push_deliveries is
  'Service-role-only per-outbox/per-subscription delivery idempotency and diagnostics.';
