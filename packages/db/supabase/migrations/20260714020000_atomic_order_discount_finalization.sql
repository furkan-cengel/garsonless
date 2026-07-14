-- Finalize an order's loyalty redemption and monetary breakdown in one DB
-- transaction. A failure while updating the order rolls back ledger debits too.
create or replace function public.finalize_order_discount(
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
  p_preview_total numeric
) returns table(
  final_total numeric,
  discount_breakdown jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_customer uuid;
  v_points_balance int := 0;
  v_stamp_balance int := 0;
  v_points_debited int := 0;
  v_stamps_debited int := 0;
  v_stamp numeric := 0;
  v_catalog numeric := 0;
  v_member numeric := 0;
  v_points_discount numeric := 0;
  v_after_free numeric := 0;
  v_remaining numeric := 0;
  v_final numeric := 0;
  v_breakdown jsonb;
begin
  select customer_id into v_order_customer
  from orders
  where id = p_order and restaurant_id = p_restaurant and deleted_at is null
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order_customer is distinct from p_customer then
    raise exception 'order_customer_mismatch';
  end if;

  if p_customer is not null and p_scope_key is not null then
    perform pg_advisory_xact_lock(hashtext(p_customer::text || ':' || p_scope_key::text));

    -- An idempotent retry uses the amounts already debited for this order.
    select abs(coalesce(sum(delta) filter (where type = 'points' and direction = 'redeem'), 0)),
           abs(coalesce(sum(delta) filter (where type = 'stamp' and direction = 'redeem'), 0))
      into v_points_debited, v_stamps_debited
    from loyalty_transactions
    where order_id = p_order;

    if v_points_debited = 0 and v_stamps_debited = 0 then
      select coalesce(sum(delta), 0) into v_points_balance
      from loyalty_transactions
      where customer_id = p_customer and scope_key = p_scope_key and type = 'points';
      select coalesce(sum(delta), 0) into v_stamp_balance
      from loyalty_transactions
      where customer_id = p_customer and scope_key = p_scope_key and type = 'stamp';

      if p_catalog_points_cost > 0 then
        if v_points_balance >= p_catalog_points_cost then
          v_points_debited := p_catalog_points_cost;
        end if;
      elsif p_points_requested > 0 and p_points_rate > 0 then
        v_points_debited := greatest(0, least(p_points_requested, (v_points_balance / p_points_rate) * p_points_rate));
      end if;
      if p_stamps_requested > 0 and v_stamp_balance >= p_stamps_requested then
        v_stamps_debited := p_stamps_requested;
      end if;

      if v_points_debited > 0 then
        insert into loyalty_transactions
          (customer_id, restaurant_id, scope_key, order_id, type, delta, reason, direction)
        values
          (p_customer, p_restaurant, p_scope_key, p_order, 'points', -v_points_debited, 'redeem', 'redeem')
        on conflict (order_id, type, direction) where order_id is not null do nothing;
      end if;
      if v_stamps_debited > 0 then
        insert into loyalty_transactions
          (customer_id, restaurant_id, scope_key, order_id, type, delta, reason, direction)
        values
          (p_customer, p_restaurant, p_scope_key, p_order, 'stamp', -v_stamps_debited, 'redeem', 'redeem')
        on conflict (order_id, type, direction) where order_id is not null do nothing;
      end if;
    end if;
  end if;

  v_stamp := case when v_stamps_debited > 0 then greatest(0, p_stamp_discount) else 0 end;
  v_catalog := case
    when p_catalog_points_cost > 0 and v_points_debited >= p_catalog_points_cost
      then greatest(0, p_catalog_discount)
    else 0
  end;
  v_after_free := greatest(0, p_subtotal - v_stamp - v_catalog);
  v_member := case
    when p_member_pct > 0 then least(v_after_free, floor(v_after_free * p_member_pct / 100))
    else 0
  end;
  v_remaining := greatest(0, v_after_free - v_member);
  v_points_discount := case
    when p_catalog_points_cost = 0 and p_points_rate > 0
      then least(v_remaining, floor(v_points_debited::numeric / p_points_rate))
    else 0
  end;
  v_final := greatest(0, p_subtotal - v_stamp - v_catalog - v_member - v_points_discount);

  v_breakdown := jsonb_build_object(
    'subtotal', p_subtotal,
    'memberDiscountAmount', v_member,
    'memberDiscountPct', p_member_pct,
    'pointsDiscountAmount', v_points_discount,
    'pointsRedeemed', case when p_catalog_points_cost = 0 then v_points_debited else 0 end,
    'stampDiscountAmount', v_stamp,
    'stampsRedeemed', v_stamps_debited,
    'rewardItemName', p_reward_item_name,
    'catalogDiscountAmount', v_catalog,
    'catalogPointsRedeemed', case when v_catalog > 0 then v_points_debited else 0 end,
    'catalogItemName', p_catalog_item_name,
    'finalTotal', v_final,
    'clamped', v_final is distinct from p_preview_total
  );

  update orders
  set total = v_final, discount_breakdown = v_breakdown, updated_at = now()
  where id = p_order;

  return query select v_final, v_breakdown;
end;
$$;

revoke execute on function public.finalize_order_discount(
  uuid, uuid, uuid, uuid, numeric, int, int, int, int, numeric, text,
  int, numeric, text, numeric
) from public, anon, authenticated;
grant execute on function public.finalize_order_discount(
  uuid, uuid, uuid, uuid, numeric, int, int, int, int, numeric, text,
  int, numeric, text, numeric
) to service_role;
