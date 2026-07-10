-- Station-based kitchen display. Stations are restaurant-owned operational
-- routing data; order lines snapshot the resolved station at order time.

create table if not exists public.kitchen_stations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 60),
  color         text not null default '#2e7d52' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position      integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists kitchen_stations_restaurant_position_idx
  on public.kitchen_stations(restaurant_id, position);
create unique index if not exists kitchen_stations_restaurant_name_active_uniq
  on public.kitchen_stations(restaurant_id, lower(trim(name)))
  where is_active;

create trigger kitchen_stations_updated_at
  before update on public.kitchen_stations
  for each row execute function public.update_updated_at();

alter table public.kitchen_stations enable row level security;

drop policy if exists "members_read_kitchen_stations" on public.kitchen_stations;
create policy "members_read_kitchen_stations" on public.kitchen_stations
  for select to authenticated using (public.has_restaurant_access(restaurant_id));

drop policy if exists "owner_manage_kitchen_stations" on public.kitchen_stations;
create policy "owner_manage_kitchen_stations" on public.kitchen_stations
  for all to authenticated
  using (public.is_restaurant_owner(restaurant_id))
  with check (public.is_restaurant_owner(restaurant_id));

alter table public.menu_categories
  add column if not exists kitchen_station_id uuid references public.kitchen_stations(id) on delete set null;

alter table public.menu_items
  add column if not exists kitchen_station_id uuid references public.kitchen_stations(id) on delete set null;

create index if not exists menu_categories_kitchen_station_idx
  on public.menu_categories(kitchen_station_id);
create index if not exists menu_items_kitchen_station_idx
  on public.menu_items(kitchen_station_id);

comment on table public.kitchen_stations is
  'Restaurant-specific kitchen routing stations shown in the token-protected KDS.';
comment on column public.menu_categories.kitchen_station_id is
  'Default kitchen station for products in this category. Snapshotted onto order lines at order time.';
comment on column public.menu_items.kitchen_station_id is
  'Optional product-level kitchen station override. Null means use the category station.';
