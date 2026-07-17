-- Split checkout hardening: reserve the uncovered balance and settle/finalize
-- in one transaction. This closes the read -> calculate -> update races that
-- could let concurrent guests reserve or settle more than a table owes.

alter table public.payment_shares
  add column if not exists checkout_amount numeric,
  add column if not exists checkout_reserved_until timestamptz;

alter table public.payment_shares
  drop constraint if exists payment_shares_checkout_amount_check,
  add constraint payment_shares_checkout_amount_check
    check (checkout_amount is null or checkout_amount > 0),
  drop constraint if exists payment_shares_checkout_reservation_check,
  add constraint payment_shares_checkout_reservation_check
    check (checkout_reserved_until is null or checkout_amount is not null);

create index if not exists payment_shares_checkout_reservation_idx
  on public.payment_shares(table_session_id, status, checkout_reserved_until)
  where status = 'declared' and checkout_amount is not null;

create or replace function public.reserve_split_checkout(
  p_share_id uuid,
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
  v_share public.payment_shares%rowtype;
  v_session_id uuid;
  v_total numeric;
  v_settled numeric;
  v_reserved numeric;
  v_remaining numeric;
  v_amount numeric;
  v_settings jsonb;
begin
  select ps.table_session_id
    into v_session_id
    from public.payment_shares ps
   where ps.id = p_share_id
     and ps.restaurant_id = p_restaurant_id;
  if v_session_id is null then
    raise exception 'Pay bulunamadı' using errcode = 'P0001';
  end if;

  -- Every checkout/settlement for a table serializes on the session row.
  perform 1
    from public.table_sessions ts
   where ts.id = v_session_id
     and ts.restaurant_id = p_restaurant_id
     and ts.table_id = p_table_id
     and ts.closed_at is null
   for update;
  if not found then
    raise exception 'Payın bağlı olduğu masa bağlantısı artık geçersiz.' using errcode = 'P0001';
  end if;

  select *
    into v_share
    from public.payment_shares ps
   where ps.id = p_share_id
     and ps.restaurant_id = p_restaurant_id
   for update;

  if v_share.status <> 'declared' then
    raise exception 'Bu pay zaten işlenmiş' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payment_share_tokens pst where pst.share_id = p_share_id) then
    raise exception 'Bu pay için ödeme zaten başlatılmış' using errcode = 'P0001';
  end if;

  select r.settings
    into v_settings
    from public.restaurants r
   where r.id = p_restaurant_id
     and r.deleted_at is null;
  if not found then
    raise exception 'Restoran bulunamadı' using errcode = 'P0001';
  end if;

  -- A request retry before provider-token attachment reuses the exact same
  -- reservation instead of consuming the balance a second time.
  if v_share.checkout_amount is not null
     and v_share.checkout_reserved_until > now() then
    return jsonb_build_object(
      'amount', v_share.checkout_amount,
      'restaurantSettings', coalesce(v_settings, '{}'::jsonb),
      'idempotent', true
    );
  end if;

  select coalesce(sum(o.total), 0)
    into v_total
    from public.orders o
   where o.table_session_id = v_session_id
     and o.restaurant_id = p_restaurant_id
     and o.status <> 'cancelled'
     and o.deleted_at is null;

  select coalesce(sum(ps.amount), 0)
    into v_settled
    from public.payment_shares ps
   where ps.table_session_id = v_session_id
     and ps.restaurant_id = p_restaurant_id
     and ps.status = 'settled';

  -- A mapped provider checkout remains reserved even after the short setup
  -- lease expires: real money may still arrive through its callback.
  select coalesce(sum(ps.checkout_amount), 0)
    into v_reserved
    from public.payment_shares ps
   where ps.table_session_id = v_session_id
     and ps.restaurant_id = p_restaurant_id
     and ps.id <> p_share_id
     and ps.status = 'declared'
     and ps.checkout_amount is not null
     and (
       ps.checkout_reserved_until > now()
       or exists (select 1 from public.payment_share_tokens pst where pst.share_id = ps.id)
     );

  v_remaining := round((v_total - v_settled - v_reserved)::numeric, 2);
  if v_remaining <= 0 then
    raise exception 'Hesap zaten kapandı veya ödeme için ayrıldı' using errcode = 'P0001';
  end if;

  v_amount := round(least(v_share.amount, v_remaining)::numeric, 2);
  if v_amount <= 0 then
    raise exception 'Geçersiz tutar' using errcode = 'P0001';
  end if;

  update public.payment_shares
     set method = 'iyzico',
         checkout_amount = v_amount,
         checkout_reserved_until = now() + make_interval(secs => greatest(least(p_reservation_seconds, 3600), 60)),
         updated_at = now()
   where id = p_share_id;

  return jsonb_build_object(
    'amount', v_amount,
    'restaurantSettings', coalesce(v_settings, '{}'::jsonb),
    'idempotent', false
  );
end;
$$;

create or replace function public.attach_split_checkout_token(
  p_share_id uuid,
  p_restaurant_id uuid,
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_existing_token text;
begin
  if coalesce(nullif(btrim(p_token), ''), '') = '' then
    raise exception 'Provider token gerekli' using errcode = '22023';
  end if;

  select ps.table_session_id into v_session_id
    from public.payment_shares ps
   where ps.id = p_share_id and ps.restaurant_id = p_restaurant_id;
  if v_session_id is null then
    raise exception 'Pay bulunamadı' using errcode = 'P0001';
  end if;
  perform 1 from public.table_sessions ts where ts.id = v_session_id for update;

  perform 1
    from public.payment_shares ps
   where ps.id = p_share_id
     and ps.restaurant_id = p_restaurant_id
     and ps.status = 'declared'
     and ps.method = 'iyzico'
     and ps.checkout_amount is not null
   for update;
  if not found then
    raise exception 'Aktif checkout rezervasyonu bulunamadı' using errcode = 'P0001';
  end if;

  select pst.token into v_existing_token
    from public.payment_share_tokens pst
   where pst.share_id = p_share_id;
  if v_existing_token is not null and v_existing_token <> p_token then
    raise exception 'Bu pay başka bir ödeme oturumuna bağlı' using errcode = 'P0001';
  end if;

  insert into public.payment_share_tokens (share_id, token)
  values (p_share_id, p_token)
  on conflict (share_id) do nothing;

  update public.payment_shares
     set checkout_reserved_until = greatest(
           coalesce(checkout_reserved_until, now()),
           now() + interval '24 hours'
         ),
         updated_at = now()
   where id = p_share_id;
  return true;
end;
$$;

create or replace function public.release_split_checkout_reservation(
  p_share_id uuid,
  p_restaurant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_updated integer;
begin
  select ps.table_session_id into v_session_id
    from public.payment_shares ps
   where ps.id = p_share_id and ps.restaurant_id = p_restaurant_id;
  if v_session_id is null then
    raise exception 'Pay bulunamadı' using errcode = 'P0001';
  end if;
  perform 1 from public.table_sessions ts where ts.id = v_session_id for update;

  update public.payment_shares ps
     set checkout_amount = null,
         checkout_reserved_until = null,
         updated_at = now()
   where ps.id = p_share_id
     and ps.restaurant_id = p_restaurant_id
     and ps.status = 'declared'
     and not exists (
       select 1 from public.payment_share_tokens pst where pst.share_id = ps.id
     );
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Bağlanmış veya işlenmiş checkout rezervasyonu bırakılamaz' using errcode = 'P0001';
  end if;
  return true;
end;
$$;

create or replace function public.settle_payment_share_atomic(
  p_share_id uuid,
  p_restaurant_id uuid,
  p_expected_method text,
  p_settled_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share public.payment_shares%rowtype;
  v_session_id uuid;
  v_total numeric;
  v_settled numeric;
  v_reserved numeric;
  v_available numeric;
  v_amount numeric;
  v_finalized boolean;
begin
  if p_expected_method not in ('iyzico', 'cash') then
    raise exception 'Geçersiz ödeme yöntemi' using errcode = '22023';
  end if;

  select ps.table_session_id into v_session_id
    from public.payment_shares ps
   where ps.id = p_share_id and ps.restaurant_id = p_restaurant_id;
  if v_session_id is null then
    raise exception 'Pay bulunamadı' using errcode = 'P0001';
  end if;
  perform 1
    from public.table_sessions ts
   where ts.id = v_session_id and ts.restaurant_id = p_restaurant_id
   for update;
  if not found then
    raise exception 'Masa oturumu bulunamadı' using errcode = 'P0001';
  end if;

  select * into v_share
    from public.payment_shares ps
   where ps.id = p_share_id and ps.restaurant_id = p_restaurant_id
   for update;

  if v_share.method is distinct from p_expected_method then
    raise exception 'Ödeme yöntemi yetkiyle eşleşmiyor' using errcode = 'P0001';
  end if;
  if v_share.status = 'void' then
    raise exception 'Pay iptal edilmiş' using errcode = 'P0001';
  end if;

  select coalesce(sum(o.total), 0) into v_total
    from public.orders o
   where o.table_session_id = v_session_id
     and o.restaurant_id = p_restaurant_id
     and o.status <> 'cancelled'
     and o.deleted_at is null;

  if v_share.status = 'settled' then
    select coalesce(sum(ps.amount), 0) into v_settled
      from public.payment_shares ps
     where ps.table_session_id = v_session_id
       and ps.restaurant_id = p_restaurant_id
       and ps.status = 'settled';
    return jsonb_build_object(
      'finalized', v_total > 0 and v_settled >= v_total,
      'amount', v_share.amount,
      'idempotent', true
    );
  end if;

  select coalesce(sum(ps.amount), 0) into v_settled
    from public.payment_shares ps
   where ps.table_session_id = v_session_id
     and ps.restaurant_id = p_restaurant_id
     and ps.status = 'settled';

  if p_expected_method = 'iyzico' then
    if v_share.checkout_amount is null or not exists (
      select 1 from public.payment_share_tokens pst where pst.share_id = p_share_id
    ) then
      raise exception 'Doğrulanmış provider checkout kaydı bulunamadı' using errcode = 'P0001';
    end if;
    v_amount := v_share.checkout_amount;
  else
    if p_settled_by is null then
      raise exception 'Nakit tahsilat için personel kimliği gerekli' using errcode = 'P0001';
    end if;
    select coalesce(sum(ps.checkout_amount), 0) into v_reserved
      from public.payment_shares ps
     where ps.table_session_id = v_session_id
       and ps.restaurant_id = p_restaurant_id
       and ps.id <> p_share_id
       and ps.status = 'declared'
       and ps.checkout_amount is not null
       and (
         ps.checkout_reserved_until > now()
         or exists (select 1 from public.payment_share_tokens pst where pst.share_id = ps.id)
       );
    v_available := round((v_total - v_settled - v_reserved)::numeric, 2);
    if v_share.amount > v_available then
      raise exception 'Nakit pay kalan tahsil edilebilir tutarı aşıyor' using errcode = 'P0001';
    end if;
    v_amount := v_share.amount;
  end if;

  if v_amount <= 0 then
    raise exception 'Geçersiz tahsilat tutarı' using errcode = 'P0001';
  end if;

  update public.payment_shares
     set amount = v_amount,
         status = 'settled',
         settled_at = now(),
         settled_by = case when p_expected_method = 'cash' then p_settled_by else null end,
         checkout_reserved_until = null,
         updated_at = now()
   where id = p_share_id;

  select coalesce(sum(ps.amount), 0) into v_settled
    from public.payment_shares ps
   where ps.table_session_id = v_session_id
     and ps.restaurant_id = p_restaurant_id
     and ps.status = 'settled';

  v_finalized := v_total > 0 and v_settled >= v_total;
  if v_finalized then
    -- The existing orders update trigger writes order.settled to domain_outbox
    -- in this same transaction. The table deliberately remains open.
    update public.orders o
       set paid_at = now(), payment_method = 'split', updated_at = now()
     where o.table_session_id = v_session_id
       and o.restaurant_id = p_restaurant_id
       and o.status <> 'cancelled'
       and o.deleted_at is null
       and o.paid_at is null;
  end if;

  return jsonb_build_object(
    'finalized', v_finalized,
    'amount', v_amount,
    'idempotent', false
  );
end;
$$;

revoke all on function public.reserve_split_checkout(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.attach_split_checkout_token(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_split_checkout_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.settle_payment_share_atomic(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_split_checkout(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.attach_split_checkout_token(uuid, uuid, text) to service_role;
grant execute on function public.release_split_checkout_reservation(uuid, uuid) to service_role;
grant execute on function public.settle_payment_share_atomic(uuid, uuid, text, uuid) to service_role;
