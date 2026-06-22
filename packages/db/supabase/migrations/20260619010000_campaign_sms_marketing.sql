-- Sprint 16c — campaign SMS + marketing consent.
-- Campaign sends are restaurant-owned, but recipient/event rows include phone
-- snapshots and therefore stay service-role-only. Dashboard server actions
-- validate ownership before reading/writing through the service role.

create table if not exists public.campaigns (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  channel             text not null default 'sms' check (channel in ('sms')),
  message_body        text not null check (char_length(btrim(message_body)) between 1 and 459),
  segment_kind        text not null default 'all' check (segment_kind in ('all', 'builtin', 'custom')),
  builtin_segment     text check (builtin_segment in ('new', 'frequent', 'lapsed', 'consented')),
  custom_segment_id   uuid references public.customer_segments(id) on delete set null,
  segment_definition  jsonb not null default '{}'::jsonb check (jsonb_typeof(segment_definition) = 'object'),
  status              text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed', 'cancelled')),
  recipient_count     int not null default 0 check (recipient_count >= 0),
  sent_count          int not null default 0 check (sent_count >= 0),
  failed_count        int not null default 0 check (failed_count >= 0),
  skipped_count       int not null default 0 check (skipped_count >= 0),
  created_by          uuid references auth.users(id) on delete set null,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint campaigns_custom_segment_matches_kind check (
    (segment_kind = 'custom' and custom_segment_id is not null)
    or (segment_kind <> 'custom' and custom_segment_id is null)
  ),
  constraint campaigns_builtin_segment_matches_kind check (
    (segment_kind = 'builtin' and builtin_segment is not null)
    or (segment_kind <> 'builtin' and builtin_segment is null)
  )
);

create index if not exists campaigns_restaurant_created_idx
  on public.campaigns(restaurant_id, created_at desc)
  where deleted_at is null;

create trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.update_updated_at();

alter table public.campaigns enable row level security;

drop policy if exists "owner_manage_campaigns" on public.campaigns;
create policy "owner_manage_campaigns" on public.campaigns
  for all to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = campaigns.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ))
  with check (exists (
    select 1 from public.restaurants r
    where r.id = campaigns.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ));

create table if not exists public.campaign_recipients (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  customer_id         uuid not null references public.customers(id) on delete cascade,
  phone               text not null,
  status              text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error               text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create index if not exists campaign_recipients_campaign_idx
  on public.campaign_recipients(campaign_id, status);

create index if not exists campaign_recipients_restaurant_customer_idx
  on public.campaign_recipients(restaurant_id, customer_id);

create trigger campaign_recipients_updated_at
  before update on public.campaign_recipients
  for each row execute function public.update_updated_at();

alter table public.campaign_recipients enable row level security;
-- Deliberately NO authenticated/anon policies: phone snapshots are PII.

create table if not exists public.message_events (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  campaign_id         uuid references public.campaigns(id) on delete set null,
  recipient_id        uuid references public.campaign_recipients(id) on delete set null,
  customer_id         uuid references public.customers(id) on delete set null,
  channel             text not null default 'sms' check (channel in ('sms')),
  event_type          text not null check (event_type in ('test_sent', 'test_failed', 'queued', 'sent', 'failed', 'provider_status')),
  phone               text,
  provider            text,
  provider_message_id text,
  error               text,
  metadata            jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists message_events_restaurant_created_idx
  on public.message_events(restaurant_id, created_at desc);

create index if not exists message_events_campaign_idx
  on public.message_events(campaign_id, created_at desc);

alter table public.message_events enable row level security;
-- Deliberately NO authenticated/anon policies: events can include PII/provider ids.
