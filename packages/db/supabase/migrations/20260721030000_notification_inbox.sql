-- Durable notification foundation (roadmap Faz 4, slice 1): a per-user
-- dashboard inbox fed by outbox events, plus per-user notification
-- preferences. Writes are service-role only; each user can read (RLS) only
-- their own rows. Billing/system entries are written regardless of prefs
-- (unmutable per ADR-0002/0003) — that rule lives in the domain layer, the
-- schema just stores what was delivered.

create table public.notification_inbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  outbox_id uuid references public.domain_outbox(id) on delete set null,
  category text not null check (category in ('order', 'service_request', 'billing', 'system')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 300),
  link_path text check (link_path is null or link_path like '/%'),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- One entry per business occurrence per recipient: replay/redelivery of the
  -- same outbox event can never duplicate a notification.
  unique (recipient_user_id, dedupe_key)
);

create index notification_inbox_unread_idx
  on public.notification_inbox (recipient_user_id, restaurant_id)
  where read_at is null;
create index notification_inbox_feed_idx
  on public.notification_inbox (recipient_user_id, restaurant_id, created_at desc);

alter table public.notification_inbox enable row level security;

-- Own-user read only. No insert/update/delete policies: all writes go through
-- the service role (consumer + mark-read server actions).
create policy notification_inbox_select_own
  on public.notification_inbox for select to authenticated
  using (recipient_user_id = auth.uid());

revoke all on public.notification_inbox from anon;

create table public.notification_preferences (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

revoke all on public.notification_preferences from anon;
