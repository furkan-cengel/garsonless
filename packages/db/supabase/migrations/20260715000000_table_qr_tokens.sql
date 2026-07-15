-- Rotation-capable public identity for table QR codes. A table UUID is an
-- internal primary key, not a revocable public credential.
create table if not exists public.table_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoke_reason text
);

create unique index if not exists table_qr_tokens_token_key
  on public.table_qr_tokens(token);
create unique index if not exists table_qr_tokens_one_active_per_table
  on public.table_qr_tokens(table_id) where revoked_at is null;
create index if not exists table_qr_tokens_active_lookup
  on public.table_qr_tokens(restaurant_id, table_id) where revoked_at is null;

alter table public.table_qr_tokens enable row level security;
revoke all on public.table_qr_tokens from anon, authenticated;

-- Existing live tables get exactly one active token. This is idempotent and
-- intentionally leaves soft-deleted tables without a public credential.
insert into public.table_qr_tokens (restaurant_id, table_id)
select t.restaurant_id, t.id
from public.tables t
where t.deleted_at is null
  and not exists (
    select 1 from public.table_qr_tokens q
    where q.table_id = t.id and q.revoked_at is null
  );

create or replace function public.create_table_qr_token()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is null then
    insert into public.table_qr_tokens (restaurant_id, table_id)
    values (new.restaurant_id, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists tables_create_qr_token on public.tables;
create trigger tables_create_qr_token
after insert on public.tables
for each row execute function public.create_table_qr_token();

-- Service-only resolver used by the menu route/API boundary. It returns no
-- token metadata and rejects deleted restaurants/tables and revoked tokens.
create or replace function public.resolve_active_table_qr_token(p_token uuid)
returns table (
  restaurant_id uuid,
  restaurant_slug text,
  table_id uuid,
  table_label text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select q.restaurant_id, r.slug, t.id, t.label
  from public.table_qr_tokens q
  join public.tables t on t.id = q.table_id
  join public.restaurants r on r.id = q.restaurant_id
  where q.token = p_token
    and q.revoked_at is null
    and t.deleted_at is null
    and r.deleted_at is null
  limit 1;
$$;

create or replace function public.list_active_table_qr_tokens(p_restaurant_id uuid)
returns table (table_id uuid, token uuid)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select q.table_id, q.token
  from public.table_qr_tokens q
  join public.tables t on t.id = q.table_id
  where q.restaurant_id = p_restaurant_id
    and q.revoked_at is null
    and t.deleted_at is null;
$$;

-- Rotation invalidates every previously active token before creating one new
-- token. The row lock serializes two dashboard clicks and preserves one active
-- credential per table.
create or replace function public.rotate_table_qr_token(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_revoked_by uuid default null,
  p_reason text default 'rotated'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token uuid;
begin
  perform 1
  from public.tables
  where id = p_table_id
    and restaurant_id = p_restaurant_id
    and deleted_at is null
  for update;

  if not found then
    return null;
  end if;

  update public.table_qr_tokens
  set revoked_at = now(),
      revoked_by = p_revoked_by,
      revoke_reason = coalesce(nullif(trim(p_reason), ''), 'rotated')
  where table_id = p_table_id
    and revoked_at is null;

  insert into public.table_qr_tokens (restaurant_id, table_id)
  values (p_restaurant_id, p_table_id)
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.resolve_active_table_qr_token(uuid) from public, anon, authenticated;
revoke all on function public.list_active_table_qr_tokens(uuid) from public, anon, authenticated;
revoke all on function public.rotate_table_qr_token(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_active_table_qr_token(uuid) to service_role;
grant execute on function public.list_active_table_qr_tokens(uuid) to service_role;
grant execute on function public.rotate_table_qr_token(uuid, uuid, uuid, text) to service_role;
