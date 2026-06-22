-- Sprint 16c follow-up — reserve service-role-only marketing integration
-- configuration for SMS/İYS providers. Credentials and provider payloads must
-- never be readable from anon/authenticated client paths.

create table if not exists public.marketing_integrations (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  provider      text not null default 'mock' check (provider in ('mock', 'netgsm', 'twilio', 'iys')),
  enabled       boolean not null default false,
  config        jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  last_synced_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger marketing_integrations_updated_at
  before update on public.marketing_integrations
  for each row execute function public.update_updated_at();

alter table public.marketing_integrations enable row level security;
-- Deliberately NO authenticated/anon policies: config may contain credentials.
