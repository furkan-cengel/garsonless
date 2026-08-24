-- Reusable tenant-owned block email templates. Designs contain presentation
-- only; recipient PII remains in service-only campaign recipient tables.

create table if not exists public.campaign_email_templates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  subject text not null default '' check (char_length(subject) <= 150),
  design jsonb not null check (jsonb_typeof(design) = 'object' and octet_length(design::text) <= 100000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists campaign_email_templates_restaurant_name_uniq
  on public.campaign_email_templates(restaurant_id, lower(btrim(name)))
  where deleted_at is null;
create index if not exists campaign_email_templates_restaurant_updated_idx
  on public.campaign_email_templates(restaurant_id, updated_at desc)
  where deleted_at is null;

drop trigger if exists campaign_email_templates_updated_at on public.campaign_email_templates;
create trigger campaign_email_templates_updated_at
  before update on public.campaign_email_templates
  for each row execute function public.update_updated_at();

alter table public.campaign_email_templates enable row level security;
drop policy if exists "owner_manage_campaign_email_templates" on public.campaign_email_templates;
create policy "owner_manage_campaign_email_templates" on public.campaign_email_templates
  for all to authenticated
  using (exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = campaign_email_templates.restaurant_id
      and restaurant.owner_id = auth.uid()
      and restaurant.deleted_at is null
  ))
  with check (exists (
    select 1 from public.restaurants restaurant
    where restaurant.id = campaign_email_templates.restaurant_id
      and restaurant.owner_id = auth.uid()
      and restaurant.deleted_at is null
  ));
