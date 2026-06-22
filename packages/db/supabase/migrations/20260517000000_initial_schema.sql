-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Auto-update updated_at on every row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── restaurants ───────────────────────────────────────────────────────────────

create table restaurants (
  id          uuid        primary key default uuid_generate_v4(),
  slug        text        not null unique,
  name        text        not null,
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  logo_url    text,
  plan        text        not null default 'free'
                          check (plan in ('free', 'starter', 'pro', 'enterprise')),
  settings    jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index restaurants_owner_id_idx on restaurants(owner_id);
create index restaurants_slug_idx     on restaurants(slug);

create trigger restaurants_updated_at
  before update on restaurants
  for each row execute function update_updated_at();

alter table restaurants enable row level security;

create policy "owner_manage_restaurant"
  on restaurants for all
  using (owner_id = auth.uid());

-- ─── tables ────────────────────────────────────────────────────────────────────

create table tables (
  id             uuid        primary key default uuid_generate_v4(),
  restaurant_id  uuid        not null references restaurants(id) on delete cascade,
  label          text        not null,
  qr_code_url    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index tables_restaurant_id_idx on tables(restaurant_id);

create trigger tables_updated_at
  before update on tables
  for each row execute function update_updated_at();

alter table tables enable row level security;

create policy "owner_manage_tables"
  on tables for all
  using (
    exists (
      select 1 from restaurants r
      where r.id = tables.restaurant_id and r.owner_id = auth.uid()
    )
  );

create policy "anon_read_tables"
  on tables for select
  using (deleted_at is null);

-- ─── menu_categories ───────────────────────────────────────────────────────────

create table menu_categories (
  id             uuid        primary key default uuid_generate_v4(),
  restaurant_id  uuid        not null references restaurants(id) on delete cascade,
  name           text        not null,
  description    text,
  position       integer     not null default 0,
  is_visible     boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index menu_categories_restaurant_id_idx on menu_categories(restaurant_id);
create index menu_categories_position_idx      on menu_categories(restaurant_id, position);

create trigger menu_categories_updated_at
  before update on menu_categories
  for each row execute function update_updated_at();

alter table menu_categories enable row level security;

create policy "owner_manage_menu_categories"
  on menu_categories for all
  using (
    exists (
      select 1 from restaurants r
      where r.id = menu_categories.restaurant_id and r.owner_id = auth.uid()
    )
  );

create policy "anon_read_menu_categories"
  on menu_categories for select
  using (is_visible = true and deleted_at is null);

-- ─── menu_items ────────────────────────────────────────────────────────────────

create table menu_items (
  id               uuid          primary key default uuid_generate_v4(),
  category_id      uuid          not null references menu_categories(id) on delete cascade,
  name             text          not null,
  description      text,
  price            numeric(10,2) not null,
  images           jsonb         not null default '[]',
  modifier_groups  jsonb         not null default '[]',
  is_available     boolean       not null default true,
  position         integer       not null default 0,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  deleted_at       timestamptz
);

create index menu_items_category_id_idx on menu_items(category_id);
create index menu_items_position_idx    on menu_items(category_id, position);
create index menu_items_name_trgm_idx   on menu_items using gin(name gin_trgm_ops);

create trigger menu_items_updated_at
  before update on menu_items
  for each row execute function update_updated_at();

alter table menu_items enable row level security;

create policy "owner_manage_menu_items"
  on menu_items for all
  using (
    exists (
      select 1 from menu_categories mc
      join restaurants r on r.id = mc.restaurant_id
      where mc.id = menu_items.category_id and r.owner_id = auth.uid()
    )
  );

create policy "anon_read_available_menu_items"
  on menu_items for select
  using (is_available = true and deleted_at is null);

-- ─── orders ────────────────────────────────────────────────────────────────────

create table orders (
  id             uuid          primary key default uuid_generate_v4(),
  restaurant_id  uuid          not null references restaurants(id) on delete cascade,
  table_id       uuid          references tables(id),
  session_id     uuid          not null,
  status         text          not null default 'pending'
                               check (status in (
                                 'pending', 'pending_approval', 'sent_to_kitchen',
                                 'preparing', 'ready', 'served', 'cancelled'
                               )),
  items          jsonb         not null default '[]',
  total          numeric(10,2) not null default 0,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  deleted_at     timestamptz
);

create index orders_restaurant_id_idx on orders(restaurant_id);
create index orders_session_id_idx    on orders(session_id);
create index orders_status_idx        on orders(restaurant_id, status);
create index orders_created_at_idx    on orders(restaurant_id, created_at desc);

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

alter table orders enable row level security;

create policy "owner_manage_orders"
  on orders for all
  using (
    exists (
      select 1 from restaurants r
      where r.id = orders.restaurant_id and r.owner_id = auth.uid()
    )
  );

-- Customers can read their own session's orders
create policy "session_read_own_orders"
  on orders for select
  using (session_id::text = current_setting('app.session_id', true));

-- Any device can create an order (session_id validated in application layer)
create policy "anyone_create_order"
  on orders for insert
  with check (true);

-- ─── theme_configs ─────────────────────────────────────────────────────────────

create table theme_configs (
  id                  uuid        primary key default uuid_generate_v4(),
  restaurant_id       uuid        not null unique references restaurants(id) on delete cascade,
  tokens              jsonb       not null default '{}',
  component_overrides jsonb       not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger theme_configs_updated_at
  before update on theme_configs
  for each row execute function update_updated_at();

alter table theme_configs enable row level security;

create policy "owner_manage_theme_configs"
  on theme_configs for all
  using (
    exists (
      select 1 from restaurants r
      where r.id = theme_configs.restaurant_id and r.owner_id = auth.uid()
    )
  );

create policy "anon_read_theme_configs"
  on theme_configs for select
  using (true);
