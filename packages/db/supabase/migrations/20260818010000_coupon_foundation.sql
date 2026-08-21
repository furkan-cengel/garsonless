-- Restaurant-scoped, server-authoritative coupon catalogue and redemption ledger.
-- Public clients never read or write these tables directly; menu/dashboard routes
-- expose purpose-built projections after tenant and entitlement checks.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  code text not null check (code ~ '^[A-Z0-9_-]{3,32}$'),
  enabled boolean not null default true,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  scope text not null default 'order' check (scope in ('order', 'category', 'product')),
  minimum_amount numeric(12,2) not null default 0 check (minimum_amount >= 0),
  maximum_discount_amount numeric(12,2) check (maximum_discount_amount is null or maximum_discount_amount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  total_usage_limit integer check (total_usage_limit is null or total_usage_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  audience text not null default 'everyone' check (audience in ('everyone', 'members', 'first_order')),
  stacking_policy text not null default 'exclusive' check (stacking_policy in ('exclusive', 'combine_loyalty')),
  marketing_label text check (marketing_label is null or length(marketing_label) <= 60),
  marketing_description text check (marketing_description is null or length(marketing_description) <= 160),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_time_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint coupons_percentage_value check (discount_type <> 'percentage' or discount_value <= 100),
  constraint coupons_member_limit_shape check (per_customer_limit is null or audience <> 'everyone')
);

create unique index coupons_restaurant_code_uidx on public.coupons(restaurant_id, code);
create index coupons_active_idx on public.coupons(restaurant_id, enabled, starts_at, ends_at)
  where archived_at is null;

create table public.coupon_categories (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  primary key (coupon_id, category_id)
);

create table public.coupon_items (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  item_id uuid not null references public.menu_items(id) on delete cascade,
  primary key (coupon_id, item_id)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  code text not null,
  discount_amount numeric(12,2) not null check (discount_amount > 0),
  status text not null default 'consumed' check (status in ('consumed', 'released')),
  consumed_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text,
  unique (order_id),
  constraint coupon_redemptions_release_shape check (
    (status = 'consumed' and released_at is null)
    or (status = 'released' and released_at is not null)
  )
);

create index coupon_redemptions_limit_idx on public.coupon_redemptions(coupon_id, status);
create index coupon_redemptions_customer_idx on public.coupon_redemptions(coupon_id, customer_id, status)
  where customer_id is not null;

alter table public.coupons enable row level security;
alter table public.coupon_categories enable row level security;
alter table public.coupon_items enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupons, public.coupon_categories, public.coupon_items, public.coupon_redemptions from public, anon, authenticated;
grant select, insert, update, delete on public.coupons, public.coupon_categories, public.coupon_items, public.coupon_redemptions to service_role;

create or replace function public.release_order_coupon_redemption(
  p_order uuid,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.coupon_redemptions
     set status = 'released', released_at = now(), release_reason = left(coalesce(p_reason, 'released'), 80)
   where order_id = p_order and status = 'consumed';
  return found;
end;
$$;

create or replace function public.release_cancelled_order_coupon_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.release_order_coupon_redemption(new.id, 'order_cancelled');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_release_cancelled_coupon on public.orders;
create trigger orders_release_cancelled_coupon
  after update of status on public.orders
  for each row execute function public.release_cancelled_order_coupon_trigger();

create or replace function public.release_full_refund_coupon_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'succeeded' and new.kind = 'full'
     and (tg_op = 'INSERT' or old.status is distinct from 'succeeded') then
    perform public.release_order_coupon_redemption(new.order_id, 'full_refund');
  end if;
  return new;
end;
$$;

drop trigger if exists order_refunds_release_coupon on public.order_refunds;
create trigger order_refunds_release_coupon
  after insert or update of status on public.order_refunds
  for each row execute function public.release_full_refund_coupon_trigger();

revoke all on function public.release_order_coupon_redemption(uuid, text) from public, anon, authenticated;
grant execute on function public.release_order_coupon_redemption(uuid, text) to service_role;

-- Replace the previous finalizer with a coupon-aware signature. Coupon limits,
-- first-order eligibility and loyalty stacking are decided under the coupon row
-- lock, in the same transaction that records the redemption and final total.
drop function if exists public.finalize_order_discount(
  uuid, uuid, uuid, uuid, numeric, int, int, int, int, numeric, text,
  int, numeric, text, numeric
);

create function public.finalize_order_discount(
  p_order uuid,
  p_restaurant uuid,
  p_customer uuid,
  p_scope_key uuid,
  p_subtotal numeric,
  p_member_pct int,
  p_points_requested int,
  p_points_rate int,
  p_stamps_requested int,
  p_stamp_discount numeric,
  p_reward_item_name text,
  p_catalog_points_cost int,
  p_catalog_discount numeric,
  p_catalog_item_name text,
  p_coupon uuid,
  p_coupon_updated_at timestamptz,
  p_coupon_eligible_subtotal numeric,
  p_coupon_stamp_eligible_discount numeric,
  p_coupon_catalog_eligible_discount numeric,
  p_preview_total numeric
) returns table(final_total numeric, discount_breakdown jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_customer uuid;
  v_coupon public.coupons%rowtype;
  v_points_balance int := 0;
  v_stamp_balance int := 0;
  v_points_debited int := 0;
  v_stamps_debited int := 0;
  v_points_request int := greatest(0, coalesce(p_points_requested, 0));
  v_stamps_request int := greatest(0, coalesce(p_stamps_requested, 0));
  v_catalog_cost int := greatest(0, coalesce(p_catalog_points_cost, 0));
  v_member_pct_requested int := greatest(0, coalesce(p_member_pct, 0));
  v_stamp numeric := 0;
  v_catalog numeric := 0;
  v_coupon_discount numeric := 0;
  v_coupon_eligible numeric := 0;
  v_member numeric := 0;
  v_points_discount numeric := 0;
  v_after_free numeric := 0;
  v_after_coupon numeric := 0;
  v_remaining numeric := 0;
  v_final numeric := 0;
  v_breakdown jsonb;
  v_total_uses integer := 0;
  v_customer_uses integer := 0;
begin
  select customer_id into v_order_customer
    from public.orders
   where id = p_order and restaurant_id = p_restaurant and deleted_at is null
   for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order_customer is distinct from p_customer then raise exception 'order_customer_mismatch'; end if;

  if p_coupon is not null then
    select * into v_coupon from public.coupons
     where id = p_coupon and restaurant_id = p_restaurant and archived_at is null
     for update;
    if not found then raise exception 'COUPON_NOT_FOUND'; end if;
    if p_coupon_updated_at is null or v_coupon.updated_at is distinct from p_coupon_updated_at then
      raise exception 'COUPON_CHANGED';
    end if;
    if not v_coupon.enabled then raise exception 'COUPON_INACTIVE'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > now() then raise exception 'COUPON_NOT_STARTED'; end if;
    if v_coupon.ends_at is not null and v_coupon.ends_at <= now() then raise exception 'COUPON_EXPIRED'; end if;
    if v_coupon.audience <> 'everyone' and p_customer is null then raise exception 'COUPON_AUTH_REQUIRED'; end if;

    select count(*) into v_total_uses from public.coupon_redemptions
     where coupon_id = p_coupon and status = 'consumed';
    if v_coupon.total_usage_limit is not null and v_total_uses >= v_coupon.total_usage_limit then
      raise exception 'COUPON_EXHAUSTED';
    end if;

    if v_coupon.per_customer_limit is not null then
      if p_customer is null then raise exception 'COUPON_AUTH_REQUIRED'; end if;
      perform pg_advisory_xact_lock(hashtext(p_restaurant::text || ':coupon:' || p_customer::text));
      select count(*) into v_customer_uses from public.coupon_redemptions
       where coupon_id = p_coupon and customer_id = p_customer and status = 'consumed';
      if v_customer_uses >= v_coupon.per_customer_limit then raise exception 'COUPON_CUSTOMER_LIMIT_REACHED'; end if;
    end if;

    if v_coupon.audience = 'first_order' then
      if p_customer is null then raise exception 'COUPON_AUTH_REQUIRED'; end if;
      perform pg_advisory_xact_lock(hashtext(p_restaurant::text || ':first-order:' || p_customer::text));
      if exists (
        select 1 from public.orders
         where restaurant_id = p_restaurant and customer_id = p_customer
           and id <> p_order and status <> 'cancelled' and deleted_at is null
      ) then raise exception 'COUPON_FIRST_ORDER_ONLY'; end if;
    end if;

    if v_coupon.stacking_policy = 'exclusive' then
      v_points_request := 0;
      v_stamps_request := 0;
      v_catalog_cost := 0;
      v_member_pct_requested := 0;
    end if;
  end if;

  if p_customer is not null and p_scope_key is not null then
    perform pg_advisory_xact_lock(hashtext(p_customer::text || ':' || p_scope_key::text));
    select abs(coalesce(sum(delta) filter (where type = 'points' and direction = 'redeem'), 0)),
           abs(coalesce(sum(delta) filter (where type = 'stamp' and direction = 'redeem'), 0))
      into v_points_debited, v_stamps_debited
      from public.loyalty_transactions where order_id = p_order;
    if v_points_debited = 0 and v_stamps_debited = 0 then
      select coalesce(sum(delta), 0) into v_points_balance from public.loyalty_transactions
       where customer_id = p_customer and scope_key = p_scope_key and type = 'points';
      select coalesce(sum(delta), 0) into v_stamp_balance from public.loyalty_transactions
       where customer_id = p_customer and scope_key = p_scope_key and type = 'stamp';
      if v_catalog_cost > 0 then
        if v_points_balance >= v_catalog_cost then v_points_debited := v_catalog_cost; end if;
      elsif v_points_request > 0 and p_points_rate > 0 then
        v_points_debited := greatest(0, least(v_points_request, (v_points_balance / p_points_rate) * p_points_rate));
      end if;
      if v_stamps_request > 0 and v_stamp_balance >= v_stamps_request then v_stamps_debited := v_stamps_request; end if;
      if v_points_debited > 0 then
        insert into public.loyalty_transactions(customer_id, restaurant_id, scope_key, order_id, type, delta, reason, direction)
        values(p_customer, p_restaurant, p_scope_key, p_order, 'points', -v_points_debited, 'redeem', 'redeem')
        on conflict (order_id, type, direction) where order_id is not null do nothing;
      end if;
      if v_stamps_debited > 0 then
        insert into public.loyalty_transactions(customer_id, restaurant_id, scope_key, order_id, type, delta, reason, direction)
        values(p_customer, p_restaurant, p_scope_key, p_order, 'stamp', -v_stamps_debited, 'redeem', 'redeem')
        on conflict (order_id, type, direction) where order_id is not null do nothing;
      end if;
    end if;
  end if;

  v_stamp := case when v_stamps_debited > 0 then greatest(0, p_stamp_discount) else 0 end;
  v_catalog := case when v_catalog_cost > 0 and v_points_debited >= v_catalog_cost then greatest(0, p_catalog_discount) else 0 end;
  v_after_free := greatest(0, p_subtotal - v_stamp - v_catalog);

  if p_coupon is not null then
    v_coupon_eligible := greatest(0,
      coalesce(p_coupon_eligible_subtotal, 0)
      - case when v_stamp > 0 then greatest(0, coalesce(p_coupon_stamp_eligible_discount, 0)) else 0 end
      - case when v_catalog > 0 then greatest(0, coalesce(p_coupon_catalog_eligible_discount, 0)) else 0 end
    );
    if v_coupon_eligible <= 0 then raise exception 'COUPON_NO_ELIGIBLE_ITEMS'; end if;
    if v_coupon_eligible < v_coupon.minimum_amount then raise exception 'COUPON_MINIMUM_NOT_MET'; end if;
    if v_coupon.discount_type = 'percentage' then
      v_coupon_discount := round(v_coupon_eligible * v_coupon.discount_value / 100, 2);
      if v_coupon.maximum_discount_amount is not null then
        v_coupon_discount := least(v_coupon_discount, v_coupon.maximum_discount_amount);
      end if;
    else
      v_coupon_discount := least(v_coupon_eligible, v_coupon.discount_value);
    end if;
    v_coupon_discount := least(v_after_free, greatest(0, v_coupon_discount));
    if v_coupon_discount <= 0 then raise exception 'COUPON_NO_ELIGIBLE_ITEMS'; end if;
  end if;

  v_after_coupon := greatest(0, v_after_free - v_coupon_discount);
  v_member := case when v_member_pct_requested > 0
    then least(v_after_coupon, floor(v_after_coupon * v_member_pct_requested / 100)) else 0 end;
  v_remaining := greatest(0, v_after_coupon - v_member);
  v_points_discount := case when v_catalog_cost = 0 and p_points_rate > 0
    then least(v_remaining, floor(v_points_debited::numeric / p_points_rate)) else 0 end;
  v_final := greatest(0, p_subtotal - v_stamp - v_catalog - v_coupon_discount - v_member - v_points_discount);

  if p_coupon is not null and v_coupon_discount > 0 then
    insert into public.coupon_redemptions(restaurant_id, coupon_id, order_id, customer_id, code, discount_amount)
    values(p_restaurant, p_coupon, p_order, p_customer, v_coupon.code, v_coupon_discount)
    on conflict (order_id) do nothing;
  end if;

  v_breakdown := jsonb_build_object(
    'subtotal', p_subtotal,
    'memberDiscountAmount', v_member,
    'memberDiscountPct', v_member_pct_requested,
    'pointsDiscountAmount', v_points_discount,
    'pointsRedeemed', case when v_catalog_cost = 0 then v_points_debited else 0 end,
    'stampDiscountAmount', v_stamp,
    'stampsRedeemed', v_stamps_debited,
    'rewardItemName', p_reward_item_name,
    'catalogDiscountAmount', v_catalog,
    'catalogPointsRedeemed', case when v_catalog > 0 then v_points_debited else 0 end,
    'catalogItemName', p_catalog_item_name,
    'couponId', case when p_coupon is null then null else v_coupon.id end,
    'couponCode', case when p_coupon is null then null else v_coupon.code end,
    'couponName', case when p_coupon is null then null else v_coupon.name end,
    'couponDiscountAmount', v_coupon_discount,
    'couponStackingPolicy', case when p_coupon is null then null else v_coupon.stacking_policy end,
    'finalTotal', v_final,
    'clamped', v_final is distinct from p_preview_total
  );
  update public.orders set total = v_final, discount_breakdown = v_breakdown, updated_at = now() where id = p_order;
  return query select v_final, v_breakdown;
end;
$$;

revoke all on function public.finalize_order_discount(
  uuid, uuid, uuid, uuid, numeric, int, int, int, int, numeric, text,
  int, numeric, text, uuid, timestamptz, numeric, numeric, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.finalize_order_discount(
  uuid, uuid, uuid, uuid, numeric, int, int, int, int, numeric, text,
  int, numeric, text, uuid, timestamptz, numeric, numeric, numeric, numeric
) to service_role;
