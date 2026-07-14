-- Public order ingress hardening + durable payment reconciliation.

alter table public.orders
  add column if not exists request_id uuid,
  add column if not exists discount_breakdown jsonb;

create unique index if not exists orders_request_id_uidx
  on public.orders(request_id)
  where request_id is not null;

-- Service-role-only distributed rate-limit journal. No public policies.
create table if not exists public.public_order_rate_events (
  id bigserial primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists public_order_rate_events_lookup_idx
  on public.public_order_rate_events(restaurant_id, key_hash, created_at desc);
alter table public.public_order_rate_events enable row level security;

create or replace function public.consume_public_order_rate_limit(
  p_restaurant_id uuid,
  p_key_hash text,
  p_max integer default 8,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_key_hash is null or length(p_key_hash) < 16 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || ':' || p_key_hash, 0));
  delete from public.public_order_rate_events
  where created_at < now() - interval '1 day';
  select count(*) into v_count
  from public.public_order_rate_events
  where restaurant_id = p_restaurant_id
    and key_hash = p_key_hash
    and created_at >= now() - make_interval(secs => greatest(1, p_window_seconds));
  if v_count >= greatest(1, p_max) then return false; end if;
  insert into public.public_order_rate_events(restaurant_id, key_hash)
  values (p_restaurant_id, p_key_hash);
  return true;
end;
$$;
revoke all on function public.consume_public_order_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_order_rate_limit(uuid, text, integer, integer) to service_role;

-- Provider payment may succeed while the local settlement write fails. Persist
-- that mismatch so it can be retried/alerted instead of living only in logs.
create table if not exists public.payment_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  share_id uuid references public.payment_shares(id) on delete cascade,
  provider_token_hash text not null,
  event_type text not null check (event_type in ('order_settlement_failed','share_settlement_failed','order_mapping_missing')),
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','resolved')),
  attempts integer not null default 0,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_reconciliation_pending_idx
  on public.payment_reconciliation_events(status, created_at)
  where status = 'pending';
alter table public.payment_reconciliation_events enable row level security;
revoke all on public.public_order_rate_events from anon, authenticated;
revoke all on public.payment_reconciliation_events from anon, authenticated;

create or replace function public.touch_payment_reconciliation_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists payment_reconciliation_touch_updated_at on public.payment_reconciliation_events;
create trigger payment_reconciliation_touch_updated_at
before update on public.payment_reconciliation_events
for each row execute function public.touch_payment_reconciliation_updated_at();

-- New sensitive columns must never join the anon realtime/REST surface.
revoke select(request_id, discount_breakdown) on public.orders from anon;
