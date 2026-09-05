-- Fail closed unless an order checkout's verified provider result proves the
-- exact reserved charge. The browser callback also checks basketId; this
-- database boundary protects every current and future caller from recording an
-- under/over-payment as settlement evidence.

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
  v_order public.orders%rowtype;
begin
  if coalesce(nullif(btrim(p_token), ''), '') = ''
     or coalesce(nullif(btrim(p_provider_payment_id), ''), '') = ''
     or char_length(btrim(p_provider_payment_id)) > 200
     or p_paid_price is null or p_paid_price <= 0 or p_paid_price <> round(p_paid_price, 2)
     or p_currency <> 'TRY' then
    raise exception 'provider_payment_evidence_invalid' using errcode = '22023';
  end if;

  select opt.* into v_token
    from public.order_payment_tokens opt
    join public.orders o on o.id = opt.order_id
   where opt.order_id = p_order_id
     and opt.token = p_token
     and o.restaurant_id = p_restaurant_id
     and o.deleted_at is null
   for update of opt, o;
  if not found then
    raise exception 'provider_payment_mapping_not_found' using errcode = 'P0001';
  end if;
  select o.* into strict v_order
    from public.orders o
   where o.id = p_order_id;

  -- Exact callback replay remains valid after settlement clears the checkout
  -- lease. Any drift in the immutable provider identity fails closed.
  if v_token.provider_payment_id is not null then
    if v_token.provider_payment_id <> btrim(p_provider_payment_id)
       or v_token.provider_paid_price is distinct from round(p_paid_price, 2)
       or v_token.provider_currency is distinct from p_currency then
      raise exception 'provider_payment_mapping_conflict' using errcode = 'P0001';
    end if;
    return true;
  end if;

  if v_order.status = 'cancelled'
     or v_order.paid_at is not null
     or v_order.checkout_amount is null
     or round(v_order.checkout_amount::numeric, 2) <> round(v_order.total::numeric, 2)
     or round(v_order.checkout_amount::numeric, 2) <> round(p_paid_price, 2) then
    raise exception 'provider_payment_amount_mismatch' using errcode = 'P0001';
  end if;

  update public.order_payment_tokens
     set provider_payment_id = btrim(p_provider_payment_id),
         provider_paid_price = round(p_paid_price, 2),
         provider_currency = p_currency
   where order_id = p_order_id
     and provider_payment_id is null;
  if not found then
    raise exception 'provider_payment_mapping_conflict' using errcode = 'P0001';
  end if;
  return true;
end;
$$;

revoke all on function public.attach_order_provider_payment(
  uuid, uuid, text, text, numeric, text
) from public, anon, authenticated;
grant execute on function public.attach_order_provider_payment(
  uuid, uuid, text, text, numeric, text
) to service_role;

comment on function public.attach_order_provider_payment(
  uuid, uuid, text, text, numeric, text
) is 'Atomically binds exact TRY provider payment evidence to the reserved order amount.';
