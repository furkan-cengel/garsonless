-- Customer continuity: service-only product favorites and atomic active-table
-- guest-order claiming. This file is intentionally safe to stage without
-- running it; provider configuration and production data are untouched.

create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, restaurant_id, menu_item_id)
);

create index if not exists customer_favorites_customer_created_idx
  on public.customer_favorites (customer_id, created_at desc, id desc);
create index if not exists customer_favorites_restaurant_item_idx
  on public.customer_favorites (restaurant_id, menu_item_id);

alter table public.customer_favorites enable row level security;
alter table public.customer_favorites force row level security;
revoke all on table public.customer_favorites from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_favorites to service_role;

create table if not exists public.customer_guest_claims (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id),
  guest_session_id uuid not null,
  device_proof_hash text not null,
  claimed_order_count integer not null default 0 check (claimed_order_count >= 0),
  created_at timestamptz not null default now(),
  unique (customer_id, restaurant_id, table_session_id, guest_session_id),
  constraint customer_guest_claims_device_proof_shape
    check (device_proof_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists customer_guest_claims_customer_created_idx
  on public.customer_guest_claims (customer_id, created_at desc);
create index if not exists customer_guest_claims_session_idx
  on public.customer_guest_claims (restaurant_id, table_session_id, guest_session_id);

alter table public.customer_guest_claims enable row level security;
alter table public.customer_guest_claims force row level security;
revoke all on table public.customer_guest_claims from public, anon, authenticated;
grant select, insert on table public.customer_guest_claims to service_role;

create or replace function public.read_customer_favorites(
  p_customer_id uuid,
  p_restaurant_id uuid default null
)
returns table (
  restaurant_id uuid,
  restaurant_slug text,
  restaurant_name text,
  restaurant_logo_url text,
  menu_item_id uuid,
  menu_item_name text,
  menu_item_description text,
  menu_item_price numeric,
  menu_item_images jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    favorite.restaurant_id,
    restaurant.slug,
    restaurant.name,
    restaurant.logo_url,
    item.id,
    item.name,
    item.description,
    item.price,
    item.images,
    favorite.created_at
  from public.customer_favorites favorite
  join public.restaurants restaurant
    on restaurant.id = favorite.restaurant_id and restaurant.deleted_at is null
  join public.menu_items item
    on item.id = favorite.menu_item_id
   and item.deleted_at is null
   and item.is_available = true
  join public.menu_categories category
    on category.id = item.category_id
   and category.restaurant_id = favorite.restaurant_id
   and category.deleted_at is null
  where favorite.customer_id = p_customer_id
    and (p_restaurant_id is null or favorite.restaurant_id = p_restaurant_id)
  order by restaurant.name, favorite.created_at desc, favorite.id desc;
$$;

create or replace function public.put_customer_favorites(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_menu_item_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_valid_ids uuid[];
begin
  if p_customer_id is null or p_restaurant_id is null
    or coalesce(array_length(p_menu_item_ids, 1), 0) not between 1 and 100 then
    raise exception 'invalid favorite request' using errcode = '22023';
  end if;

  select coalesce(array_agg(item.id order by item.id), '{}'::uuid[])
  into v_valid_ids
  from public.menu_items item
  join public.menu_categories category
    on category.id = item.category_id
   and category.restaurant_id = p_restaurant_id
   and category.deleted_at is null
  join public.restaurants restaurant
    on restaurant.id = category.restaurant_id
   and restaurant.deleted_at is null
  where item.id = any(p_menu_item_ids)
    and item.is_available = true
    and item.deleted_at is null;

  insert into public.customer_favorites (customer_id, restaurant_id, menu_item_id)
  select p_customer_id, p_restaurant_id, item_id
  from unnest(v_valid_ids) item_id
  on conflict (customer_id, restaurant_id, menu_item_id) do nothing;

  return v_valid_ids;
end;
$$;

create or replace function public.delete_customer_favorite(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_menu_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.customer_favorites favorite
  where favorite.customer_id = p_customer_id
    and favorite.restaurant_id = p_restaurant_id
    and favorite.menu_item_id = p_menu_item_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.claim_active_customer_guest_orders(
  p_request_id uuid,
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_table_token uuid,
  p_guest_session_id uuid,
  p_device_proof_hash text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table_session_id uuid;
  v_existing_count integer;
  v_claimed_count integer := 0;
begin
  if p_request_id is null or p_customer_id is null or p_restaurant_id is null
    or p_table_token is null or p_guest_session_id is null
    or p_device_proof_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid guest claim request' using errcode = '22023';
  end if;

  select claim.claimed_order_count into v_existing_count
  from public.customer_guest_claims claim
  where claim.request_id = p_request_id;
  if found then return v_existing_count; end if;

  select session.id into v_table_session_id
  from public.table_qr_tokens token
  join public.tables table_record
    on table_record.id = token.table_id
   and table_record.restaurant_id = token.restaurant_id
   and table_record.deleted_at is null
  join public.table_sessions session
    on session.table_id = token.table_id
   and session.restaurant_id = token.restaurant_id
   and session.closed_at is null
  join public.restaurants restaurant
    on restaurant.id = token.restaurant_id and restaurant.deleted_at is null
  where token.token = p_table_token
    and token.restaurant_id = p_restaurant_id
    and token.revoked_at is null
  limit 1;

  if v_table_session_id is null then
    raise exception 'active table context not found' using errcode = 'GL004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'customer-guest-claim:' || p_restaurant_id::text || ':'
      || v_table_session_id::text || ':' || p_guest_session_id::text,
    0
  ));

  select claim.claimed_order_count into v_existing_count
  from public.customer_guest_claims claim
  where claim.customer_id = p_customer_id
    and claim.restaurant_id = p_restaurant_id
    and claim.table_session_id = v_table_session_id
    and claim.guest_session_id = p_guest_session_id;
  if found then return v_existing_count; end if;

  if exists (
    select 1 from public.orders customer_order
    where customer_order.restaurant_id = p_restaurant_id
      and customer_order.table_session_id = v_table_session_id
      and customer_order.session_id = p_guest_session_id
      and customer_order.deleted_at is null
      and customer_order.customer_id is not null
      and customer_order.customer_id <> p_customer_id
  ) then
    raise exception 'guest orders already belong to another customer' using errcode = 'GL005';
  end if;

  update public.orders customer_order
  set customer_id = p_customer_id,
      updated_at = now()
  where customer_order.restaurant_id = p_restaurant_id
    and customer_order.table_session_id = v_table_session_id
    and customer_order.session_id = p_guest_session_id
    and customer_order.deleted_at is null
    and customer_order.customer_id is null;
  get diagnostics v_claimed_count = row_count;

  insert into public.customer_guest_claims (
    request_id, customer_id, restaurant_id, table_session_id,
    guest_session_id, device_proof_hash, claimed_order_count
  ) values (
    p_request_id, p_customer_id, p_restaurant_id, v_table_session_id,
    p_guest_session_id, p_device_proof_hash, v_claimed_count
  );

  return v_claimed_count;
end;
$$;

revoke all on function public.read_customer_favorites(uuid, uuid) from public, anon, authenticated;
revoke all on function public.put_customer_favorites(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_customer_favorite(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_active_customer_guest_orders(uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.read_customer_favorites(uuid, uuid) to service_role;
grant execute on function public.put_customer_favorites(uuid, uuid, uuid[]) to service_role;
grant execute on function public.delete_customer_favorite(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_active_customer_guest_orders(uuid, uuid, uuid, uuid, uuid, text) to service_role;
