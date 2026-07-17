-- Single-order checkout must have the same concurrency guarantees as split
-- checkout. A short DB-owned lease allows exactly one provider initialization;
-- the provider token then becomes immutable for that order.

alter table public.orders
  add column if not exists checkout_amount numeric(12,2),
  add column if not exists checkout_reserved_until timestamptz,
  add column if not exists checkout_reservation_id uuid;

alter table public.orders drop constraint if exists orders_checkout_reservation_shape;
alter table public.orders add constraint orders_checkout_reservation_shape check (
  (checkout_amount is null and checkout_reserved_until is null and checkout_reservation_id is null)
  or (checkout_amount is not null and checkout_reserved_until is not null and checkout_reservation_id is not null)
);

create index if not exists orders_checkout_reservation_idx
  on public.orders(checkout_reserved_until)
  where checkout_reserved_until is not null and paid_at is null;

create or replace function public.reserve_order_checkout(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_table_id uuid,
  p_reservation_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_settings jsonb;
  v_reservation_id uuid;
begin
  select * into v_order
    from public.orders o
   where o.id = p_order_id
     and o.restaurant_id = p_restaurant_id
     and o.table_id = p_table_id
     and o.deleted_at is null
   for update;
  if not found then
    raise exception 'Sipariş bulunamadı' using errcode = 'P0001';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'İptal edilmiş sipariş ödenemez' using errcode = 'P0001';
  end if;
  if v_order.paid_at is not null then
    raise exception 'Sipariş zaten ödendi' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.order_payment_tokens opt where opt.order_id = p_order_id) then
    raise exception 'Bu sipariş için ödeme oturumu zaten başlatıldı' using errcode = 'P0001';
  end if;
  if v_order.checkout_reserved_until is not null
     and v_order.checkout_reserved_until > now() then
    raise exception 'Ödeme oturumu hazırlanıyor; lütfen kısa süre sonra tekrar deneyin' using errcode = 'P0001';
  end if;
  if round(v_order.total::numeric, 2) <= 0 then
    raise exception 'Geçersiz tutar' using errcode = 'P0001';
  end if;

  select r.settings into v_settings
    from public.restaurants r
   where r.id = p_restaurant_id and r.deleted_at is null;
  if not found then
    raise exception 'Restoran bulunamadı' using errcode = 'P0001';
  end if;

  v_reservation_id := gen_random_uuid();
  update public.orders
     set checkout_amount = round(v_order.total::numeric, 2),
         checkout_reserved_until = now() + make_interval(secs => greatest(least(p_reservation_seconds, 3600), 60)),
         checkout_reservation_id = v_reservation_id,
         updated_at = now()
   where id = p_order_id;

  return jsonb_build_object(
    'amount', round(v_order.total::numeric, 2),
    'restaurantSettings', coalesce(v_settings, '{}'::jsonb),
    'reservationId', v_reservation_id
  );
end;
$$;

create or replace function public.attach_order_checkout_token(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_reservation_id uuid,
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_existing_token text;
begin
  if coalesce(nullif(btrim(p_token), ''), '') = '' then
    raise exception 'Provider token gerekli' using errcode = '22023';
  end if;
  select * into v_order
    from public.orders o
   where o.id = p_order_id and o.restaurant_id = p_restaurant_id
   for update;
  if not found then raise exception 'Sipariş bulunamadı' using errcode = 'P0001'; end if;
  if v_order.status = 'cancelled' or v_order.paid_at is not null then
    raise exception 'Sipariş ödeme kabul etmiyor' using errcode = 'P0001';
  end if;
  if v_order.checkout_reservation_id is distinct from p_reservation_id
     or v_order.checkout_amount is null
     or v_order.checkout_reserved_until <= now() then
    raise exception 'Checkout rezervasyonu geçersiz veya süresi dolmuş' using errcode = 'P0001';
  end if;

  select opt.token into v_existing_token
    from public.order_payment_tokens opt where opt.order_id = p_order_id;
  if v_existing_token is not null and v_existing_token <> p_token then
    raise exception 'Bu sipariş başka bir ödeme oturumuna bağlı' using errcode = 'P0001';
  end if;
  insert into public.order_payment_tokens(order_id, token)
  values (p_order_id, p_token)
  on conflict (order_id) do nothing;

  update public.orders
     set checkout_reserved_until = now() + interval '24 hours', updated_at = now()
   where id = p_order_id;
  return true;
end;
$$;

create or replace function public.release_order_checkout_reservation(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_updated integer;
begin
  perform 1 from public.orders o
   where o.id = p_order_id and o.restaurant_id = p_restaurant_id for update;
  if not found then raise exception 'Sipariş bulunamadı' using errcode = 'P0001'; end if;
  update public.orders o
     set checkout_amount = null,
         checkout_reserved_until = null,
         checkout_reservation_id = null,
         updated_at = now()
   where o.id = p_order_id
     and o.restaurant_id = p_restaurant_id
     and o.checkout_reservation_id = p_reservation_id
     and o.paid_at is null
     and not exists (select 1 from public.order_payment_tokens opt where opt.order_id = o.id);
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Bağlanmış veya geçersiz checkout rezervasyonu bırakılamaz' using errcode = 'P0001';
  end if;
  return true;
end;
$$;

create or replace function public.clear_order_checkout_after_terminal_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.paid_at is not null or new.status = 'cancelled' then
    new.checkout_amount := null;
    new.checkout_reserved_until := null;
    new.checkout_reservation_id := null;
  end if;
  return new;
end $$;
drop trigger if exists orders_clear_checkout_after_terminal_change on public.orders;
create trigger orders_clear_checkout_after_terminal_change
before update of paid_at, status on public.orders
for each row execute function public.clear_order_checkout_after_terminal_change();

revoke all on function public.reserve_order_checkout(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.attach_order_checkout_token(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_order_checkout_reservation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_order_checkout(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.attach_order_checkout_token(uuid, uuid, uuid, text) to service_role;
grant execute on function public.release_order_checkout_reservation(uuid, uuid, uuid) to service_role;

-- Durable, idempotent recovery queue for provider-success/local-write-failure.
alter table public.payment_reconciliation_events
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_error text,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists idempotency_key text;

update public.payment_reconciliation_events
set idempotency_key = md5(
  provider_token_hash || ':' || event_type || ':' || coalesce(order_id::text, '') || ':' || coalesce(share_id::text, '')
)
where idempotency_key is null;
-- Historical callback retries may already have written duplicate pending rows.
-- Keep the oldest event so the unique key can be installed safely in PROD.
delete from public.payment_reconciliation_events duplicate
using public.payment_reconciliation_events keeper
where duplicate.idempotency_key = keeper.idempotency_key
  and (duplicate.created_at, duplicate.id) > (keeper.created_at, keeper.id);
alter table public.payment_reconciliation_events alter column idempotency_key set not null;
create unique index if not exists payment_reconciliation_idempotency_uidx
  on public.payment_reconciliation_events(idempotency_key);
drop index if exists public.payment_reconciliation_pending_idx;
create index payment_reconciliation_pending_idx
  on public.payment_reconciliation_events(available_at, created_at)
  where status = 'pending' and dead_lettered_at is null;

create or replace function public.enqueue_payment_reconciliation(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_share_id uuid,
  p_provider_token_hash text,
  p_event_type text,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_key text; v_id uuid;
begin
  if p_event_type not in ('order_settlement_failed','share_settlement_failed','order_mapping_missing') then
    raise exception 'Geçersiz reconciliation olayı' using errcode = '22023';
  end if;
  v_key := md5(
    p_provider_token_hash || ':' || p_event_type || ':' || coalesce(p_order_id::text, '') || ':' || coalesce(p_share_id::text, '')
  );
  insert into public.payment_reconciliation_events(
    restaurant_id, order_id, share_id, provider_token_hash, event_type, detail, idempotency_key
  ) values (
    p_restaurant_id, p_order_id, p_share_id, p_provider_token_hash, p_event_type, coalesce(p_detail, '{}'::jsonb), v_key
  )
  on conflict (idempotency_key) do update
    set detail = excluded.detail,
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.claim_payment_reconciliation(
  p_worker text,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns setof public.payment_reconciliation_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(nullif(btrim(p_worker), ''), '') = '' then
    raise exception 'worker is required' using errcode = '22023';
  end if;
  return query
  with candidate as (
    select id from public.payment_reconciliation_events
    where status = 'pending'
      and dead_lettered_at is null
      and available_at <= now()
      and (locked_at is null or locked_at < now() - make_interval(secs => greatest(p_lease_seconds, 1)))
    order by created_at, id
    limit greatest(least(p_limit, 100), 1)
    for update skip locked
  )
  update public.payment_reconciliation_events event
     set locked_at = now(), locked_by = p_worker, attempts = event.attempts + 1
    from candidate where event.id = candidate.id
  returning event.*;
end;
$$;

create or replace function public.resolve_payment_reconciliation(p_event_id uuid, p_worker text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.payment_reconciliation_events
     set status = 'resolved', resolved_at = now(), locked_at = null, locked_by = null, last_error = null
   where id = p_event_id and status = 'pending' and locked_by = p_worker;
  return found;
end $$;

create or replace function public.fail_payment_reconciliation(
  p_event_id uuid, p_worker text, p_error text, p_delay_seconds integer default 60
)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_attempts integer;
begin
  select attempts into v_attempts from public.payment_reconciliation_events
   where id = p_event_id and status = 'pending' and dead_lettered_at is null and locked_by = p_worker
   for update;
  if not found then return 'lease_lost'; end if;
  update public.payment_reconciliation_events
     set locked_at = null,
         locked_by = null,
         available_at = case when v_attempts >= 8 then available_at else now() + make_interval(secs => greatest(1, least(p_delay_seconds, 86400))) end,
         dead_lettered_at = case when v_attempts >= 8 then now() else null end,
         last_error = left(coalesce(p_error, 'unknown error'), 1000)
   where id = p_event_id;
  return case when v_attempts >= 8 then 'dead_lettered' else 'retry_scheduled' end;
end $$;

revoke all on function public.enqueue_payment_reconciliation(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_payment_reconciliation(text, integer, integer) from public, anon, authenticated;
revoke all on function public.resolve_payment_reconciliation(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_payment_reconciliation(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.enqueue_payment_reconciliation(uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.claim_payment_reconciliation(text, integer, integer) to service_role;
grant execute on function public.resolve_payment_reconciliation(uuid, text) to service_role;
grant execute on function public.fail_payment_reconciliation(uuid, text, text, integer) to service_role;

-- Never expose checkout coordination internals on the anon order surface.
revoke select(checkout_amount, checkout_reserved_until, checkout_reservation_id) on public.orders from anon;
