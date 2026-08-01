-- Monetary order refunds. Successful cash/physical-POS rows are owner-entered;
-- successful iyzico rows can only be finalized after a verified provider reply.
-- RLS has no client policies: every write goes through the service-role RPCs
-- below after the application layer has established actor + tenant authority.

alter table public.order_payment_tokens
  add column if not exists provider_payment_id text,
  add column if not exists provider_paid_price numeric(12,2),
  add column if not exists provider_currency text;

create unique index if not exists order_payment_tokens_provider_payment_uidx
  on public.order_payment_tokens(provider_payment_id)
  where provider_payment_id is not null;

alter table public.order_payment_tokens drop constraint if exists order_payment_tokens_provider_shape;
alter table public.order_payment_tokens add constraint order_payment_tokens_provider_shape check (
  (provider_payment_id is null and provider_paid_price is null and provider_currency is null)
  or (
    provider_payment_id is not null
    and provider_paid_price is not null and provider_paid_price > 0
    and provider_currency = 'TRY'
  )
);

-- Composite key gives the ledger a structural tenant/order invariant even for
-- service-role maintenance code that does not use the RPCs.
alter table public.orders
  add constraint orders_id_restaurant_refund_unique unique (id, restaurant_id);

create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash', 'pos', 'iyzico')),
  source text not null check (source in ('manual', 'provider')),
  status text not null check (status in ('pending', 'succeeded', 'failed', 'pending_reconciliation')),
  kind text not null check (kind in ('full', 'partial')),
  amount numeric(12,2) not null check (amount > 0 and amount = round(amount, 2)),
  currency text not null default 'TRY' check (currency = 'TRY'),
  reason text,
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  actor_user_id uuid references auth.users(id) on delete set null,
  provider text check (provider is null or provider = 'iyzico'),
  provider_payment_id text,
  provider_refund_ref text,
  failure_code text,
  failure_message text,
  requested_at timestamptz not null default now(),
  refunded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint order_refunds_order_tenant_fkey foreign key (order_id, restaurant_id)
    references public.orders(id, restaurant_id) on delete restrict,
  constraint order_refunds_source_shape check (
    (source = 'manual' and payment_method in ('cash', 'pos') and status = 'succeeded'
      and actor_user_id is not null and provider is null and provider_payment_id is null
      and provider_refund_ref is null and refunded_at is not null)
    or
    (source = 'provider' and payment_method = 'iyzico' and provider = 'iyzico'
      and actor_user_id is null and provider_payment_id is not null
      and (
        (status = 'succeeded' and provider_refund_ref is not null and refunded_at is not null)
        or (status in ('pending', 'failed', 'pending_reconciliation') and refunded_at is null)
      ))
  )
);

create unique index if not exists order_refunds_idempotency_uidx
  on public.order_refunds(restaurant_id, source, idempotency_key);
create index if not exists order_refunds_analytics_idx
  on public.order_refunds(restaurant_id, refunded_at)
  where status = 'succeeded';
create index if not exists order_refunds_order_idx
  on public.order_refunds(restaurant_id, order_id, requested_at);

alter table public.order_refunds enable row level security;
revoke all on table public.order_refunds from public, anon, authenticated;
grant select, insert, update on table public.order_refunds to service_role;

create or replace function public.attach_order_provider_payment(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_token text,
  p_provider_payment_id text,
  p_paid_price numeric,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.order_payment_tokens%rowtype;
begin
  if coalesce(nullif(btrim(p_token), ''), '') = ''
     or coalesce(nullif(btrim(p_provider_payment_id), ''), '') = ''
     or p_paid_price is null or p_paid_price <= 0 or p_paid_price <> round(p_paid_price, 2)
     or p_currency <> 'TRY' then
    raise exception 'Provider ödeme sonucu geçersiz' using errcode = '22023';
  end if;

  select opt.* into v_token
    from public.order_payment_tokens opt
    join public.orders o on o.id = opt.order_id
   where opt.order_id = p_order_id
     and opt.token = p_token
     and o.restaurant_id = p_restaurant_id
     and o.deleted_at is null
   for update of opt;
  if not found then
    raise exception 'Provider ödeme eşlemesi bulunamadı' using errcode = 'P0001';
  end if;
  if v_token.provider_payment_id is not null and (
    v_token.provider_payment_id <> btrim(p_provider_payment_id)
    or v_token.provider_paid_price is distinct from round(p_paid_price, 2)
    or v_token.provider_currency is distinct from p_currency
  ) then
    raise exception 'Provider ödeme eşlemesi çakışıyor' using errcode = 'P0001';
  end if;

  update public.order_payment_tokens
     set provider_payment_id = btrim(p_provider_payment_id),
         provider_paid_price = round(p_paid_price, 2),
         provider_currency = p_currency
   where order_id = p_order_id;
  return true;
end;
$$;

create or replace function public.record_manual_order_refund(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_amount numeric,
  p_reason text,
  p_actor_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_refunds%rowtype;
  v_refunded numeric(12,2);
  v_remaining numeric(12,2);
  v_kind text;
  v_row public.order_refunds%rowtype;
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or length(coalesce(btrim(p_reason), '')) < 3 or length(btrim(p_reason)) > 200
     or length(coalesce(btrim(p_idempotency_key), '')) < 1
     or length(btrim(p_idempotency_key)) > 200 then
    raise exception 'Manuel iade girdisi geçersiz' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.restaurants r
     where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_existing from public.order_refunds
   where restaurant_id = p_restaurant_id and source = 'manual'
     and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.order_id <> p_order_id or v_existing.amount <> round(p_amount, 2)
       or v_existing.reason is distinct from btrim(p_reason)
       or v_existing.actor_user_id is distinct from p_actor_user_id then
      raise exception 'İade idempotency anahtarı farklı bir istek için kullanılmış' using errcode = 'P0001';
    end if;
    return to_jsonb(v_existing) || jsonb_build_object('replayed', true);
  end if;

  select * into v_order from public.orders o
   where o.id = p_order_id and o.restaurant_id = p_restaurant_id and o.deleted_at is null
   for update;
  if not found then raise exception 'Sipariş bulunamadı' using errcode = 'P0001'; end if;
  if v_order.paid_at is null or v_order.payment_method is null
     or v_order.payment_method not in ('cash', 'pos') then
    raise exception 'Yalnızca tahsil edilmiş nakit/fiziksel POS siparişi manuel iade edilebilir' using errcode = 'P0001';
  end if;

  select coalesce(sum(r.amount), 0) into v_refunded
    from public.order_refunds r
   where r.restaurant_id = p_restaurant_id and r.order_id = p_order_id and r.status = 'succeeded';
  v_remaining := round(v_order.total::numeric - v_refunded, 2);
  if p_amount > v_remaining or v_remaining <= 0 then
    raise exception 'İade tutarı kalan iade edilebilir tutarı aşıyor' using errcode = 'P0001';
  end if;
  v_kind := case when round(p_amount, 2) = v_remaining then 'full' else 'partial' end;

  insert into public.order_refunds(
    restaurant_id, order_id, payment_method, source, status, kind, amount,
    reason, idempotency_key, actor_user_id, refunded_at
  ) values (
    p_restaurant_id, p_order_id, v_order.payment_method, 'manual', 'succeeded', v_kind,
    round(p_amount, 2), btrim(p_reason), btrim(p_idempotency_key), p_actor_user_id, clock_timestamp()
  ) returning * into v_row;
  return to_jsonb(v_row) || jsonb_build_object('replayed', false);
end;
$$;

create or replace function public.reserve_iyzico_order_refund(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_amount numeric,
  p_reason text,
  p_actor_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_refunds%rowtype;
  v_mapping public.order_payment_tokens%rowtype;
  v_reserved numeric(12,2);
  v_remaining numeric(12,2);
  v_kind text;
  v_row public.order_refunds%rowtype;
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or length(coalesce(btrim(p_reason), '')) < 3 or length(btrim(p_reason)) > 200
     or length(coalesce(btrim(p_idempotency_key), '')) < 1
     or length(btrim(p_idempotency_key)) > 200 then
    raise exception 'İyzico iade girdisi geçersiz' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.restaurants r
     where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_existing from public.order_refunds
   where restaurant_id = p_restaurant_id and source = 'provider'
     and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.order_id <> p_order_id or v_existing.amount <> round(p_amount, 2)
       or v_existing.reason is distinct from btrim(p_reason) then
      raise exception 'İade idempotency anahtarı farklı bir istek için kullanılmış' using errcode = 'P0001';
    end if;
    return to_jsonb(v_existing) || jsonb_build_object('replayed', true);
  end if;

  select * into v_order from public.orders o
   where o.id = p_order_id and o.restaurant_id = p_restaurant_id and o.deleted_at is null
   for update;
  if not found then raise exception 'Sipariş bulunamadı' using errcode = 'P0001'; end if;
  if v_order.paid_at is null or v_order.payment_method is null
     or v_order.payment_method <> 'iyzico' then
    raise exception 'Yalnızca tahsil edilmiş İyzico siparişi sağlayıcı üzerinden iade edilebilir' using errcode = 'P0001';
  end if;

  select opt.* into v_mapping from public.order_payment_tokens opt where opt.order_id = p_order_id;
  if not found or v_mapping.provider_payment_id is null then
    raise exception 'Bu siparişin İyzico paymentId eşlemesi yok; otomatik iade güvenle başlatılamaz' using errcode = 'P0001';
  end if;

  select coalesce(sum(r.amount), 0) into v_reserved
    from public.order_refunds r
   where r.restaurant_id = p_restaurant_id and r.order_id = p_order_id
     and r.status in ('pending', 'pending_reconciliation', 'succeeded');
  v_remaining := round(least(v_order.total, v_mapping.provider_paid_price)::numeric - v_reserved, 2);
  if p_amount > v_remaining or v_remaining <= 0 then
    raise exception 'İade tutarı kalan iade edilebilir tutarı aşıyor' using errcode = 'P0001';
  end if;
  v_kind := case when round(p_amount, 2) = v_remaining then 'full' else 'partial' end;

  insert into public.order_refunds(
    restaurant_id, order_id, payment_method, source, status, kind, amount, reason,
    idempotency_key, provider, provider_payment_id
  ) values (
    p_restaurant_id, p_order_id, 'iyzico', 'provider', 'pending', v_kind, round(p_amount, 2),
    btrim(p_reason), btrim(p_idempotency_key), 'iyzico', v_mapping.provider_payment_id
  ) returning * into v_row;
  return to_jsonb(v_row) || jsonb_build_object('replayed', false);
end;
$$;

create or replace function public.finalize_iyzico_order_refund(
  p_refund_id uuid,
  p_order_id uuid,
  p_restaurant_id uuid,
  p_amount numeric,
  p_provider_payment_id text,
  p_provider_refund_ref text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.order_refunds%rowtype;
begin
  select * into v_row from public.order_refunds r
   where r.id = p_refund_id and r.order_id = p_order_id and r.restaurant_id = p_restaurant_id
     and r.source = 'provider' and r.provider = 'iyzico'
   for update;
  if not found then raise exception 'İyzico iade talebi bulunamadı' using errcode = 'P0001'; end if;
  if v_row.amount <> round(p_amount, 2)
     or v_row.provider_payment_id <> btrim(p_provider_payment_id)
     or v_row.idempotency_key <> btrim(p_idempotency_key)
     or coalesce(nullif(btrim(p_provider_refund_ref), ''), '') = '' then
    raise exception 'Doğrulanmış İyzico iade cevabı taleple eşleşmiyor' using errcode = 'P0001';
  end if;
  if v_row.status = 'succeeded' then
    if v_row.provider_refund_ref <> btrim(p_provider_refund_ref) then
      raise exception 'İyzico iade sonucu çakışıyor' using errcode = 'P0001';
    end if;
    return to_jsonb(v_row);
  end if;
  if v_row.status <> 'pending' then
    raise exception 'İyzico iade talebi sonuçlandırılamaz' using errcode = 'P0001';
  end if;

  update public.order_refunds
     set status = 'succeeded', provider_refund_ref = btrim(p_provider_refund_ref),
         refunded_at = clock_timestamp(), updated_at = clock_timestamp(),
         failure_code = null, failure_message = null
   where id = p_refund_id
   returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.fail_iyzico_order_refund(
  p_refund_id uuid,
  p_order_id uuid,
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_status text,
  p_failure_code text,
  p_failure_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('failed', 'pending_reconciliation') then
    raise exception 'Geçersiz İyzico iade durumu' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.restaurants r
     where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.order_refunds r
     set status = p_status,
         failure_code = left(nullif(btrim(p_failure_code), ''), 80),
         failure_message = left(nullif(btrim(p_failure_message), ''), 300),
         updated_at = clock_timestamp()
   where r.id = p_refund_id and r.order_id = p_order_id and r.restaurant_id = p_restaurant_id
     and r.source = 'provider' and r.status = 'pending';
  if not found then
    if exists (select 1 from public.order_refunds r where r.id = p_refund_id and r.status = p_status) then
      return true;
    end if;
    raise exception 'İyzico iade talebi güncellenemedi' using errcode = 'P0001';
  end if;
  return true;
end;
$$;

create or replace function public.cancel_paid_manual_order_with_refund(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_reason text,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_refunded numeric(12,2);
  v_remaining numeric(12,2);
begin
  if length(coalesce(btrim(p_reason), '')) < 3 or length(btrim(p_reason)) > 200 then
    raise exception 'İptal/iade gerekçesi geçersiz' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.restaurants r
     where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_order from public.orders o
   where o.id = p_order_id and o.restaurant_id = p_restaurant_id and o.deleted_at is null
   for update;
  if not found then raise exception 'Sipariş bulunamadı' using errcode = 'P0001'; end if;
  if v_order.status = 'cancelled' then return true; end if;
  if v_order.paid_at is null or v_order.payment_method is null
     or v_order.payment_method not in ('cash', 'pos') then
    raise exception 'Bu atomik akış yalnızca tahsil edilmiş nakit/fiziksel POS siparişi içindir' using errcode = 'P0001';
  end if;

  select coalesce(sum(r.amount), 0) into v_refunded from public.order_refunds r
   where r.restaurant_id = p_restaurant_id and r.order_id = p_order_id and r.status = 'succeeded';
  v_remaining := round(v_order.total::numeric - v_refunded, 2);
  if v_remaining < 0 then
    raise exception 'Sipariş iade toplamı sipariş tutarını aşıyor' using errcode = 'P0001';
  end if;
  if v_remaining > 0 then
    perform public.record_manual_order_refund(
      p_order_id, p_restaurant_id, v_remaining, btrim(p_reason), p_actor_user_id,
      'cancel:' || p_order_id::text
    );
  end if;

  update public.orders
     set status = 'cancelled', cancel_reason = btrim(p_reason),
         cancelled_by = p_actor_user_id, updated_at = clock_timestamp()
   where id = p_order_id and restaurant_id = p_restaurant_id and status <> 'cancelled';
  return true;
end;
$$;

revoke all on function public.attach_order_provider_payment(uuid, uuid, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.record_manual_order_refund(uuid, uuid, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function public.reserve_iyzico_order_refund(uuid, uuid, numeric, text, uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_iyzico_order_refund(uuid, uuid, uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_iyzico_order_refund(uuid, uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_paid_manual_order_with_refund(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.attach_order_provider_payment(uuid, uuid, text, text, numeric, text) to service_role;
grant execute on function public.record_manual_order_refund(uuid, uuid, numeric, text, uuid, text) to service_role;
grant execute on function public.reserve_iyzico_order_refund(uuid, uuid, numeric, text, uuid, text) to service_role;
grant execute on function public.finalize_iyzico_order_refund(uuid, uuid, uuid, numeric, text, text, text) to service_role;
grant execute on function public.fail_iyzico_order_refund(uuid, uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.cancel_paid_manual_order_with_refund(uuid, uuid, text, uuid) to service_role;
