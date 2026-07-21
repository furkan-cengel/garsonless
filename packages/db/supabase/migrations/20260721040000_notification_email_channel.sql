-- Email notification channel (roadmap Faz 4, slice 2): platform template
-- overrides and per-recipient delivery tracking with retry/dead-letter state.
-- Both tables are strictly service-role: deliveries snapshot recipient e-mail
-- addresses (PII) and templates are platform-admin material (Faz 6). RLS is
-- enabled with zero policies and both browser roles are revoked outright.

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('order', 'service_request', 'billing', 'system')),
  channel text not null check (channel in ('email', 'sms')),
  subject text not null check (char_length(subject) between 1 and 200),
  body_html text not null check (char_length(body_html) between 1 and 20000),
  updated_at timestamptz not null default now(),
  unique (category, channel)
);

alter table public.notification_templates enable row level security;
revoke all on public.notification_templates from anon, authenticated;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references public.domain_outbox(id) on delete set null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  category text not null check (category in ('order', 'service_request', 'billing', 'system')),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  recipient_address text not null,
  subject text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The "never five e-mails for one occurrence" guarantee: one delivery row
  -- per recipient + business occurrence + channel, whatever the retry count.
  unique (recipient_user_id, dedupe_key, channel)
);

create index notification_deliveries_restaurant_idx
  on public.notification_deliveries (restaurant_id, created_at desc);
create index notification_deliveries_status_idx
  on public.notification_deliveries (status, updated_at desc)
  where status in ('pending', 'failed');

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
