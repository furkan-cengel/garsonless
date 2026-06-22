-- Üyelik + Sadakat — Phase 15c: reward-catalog redemption.
-- A catalog reward debits an EXACT pointCost (read server-side from config) and
-- takes one free unit of a specific item off the bill. Unlike points-as-₺
-- (partial, whole-₺ multiples), a catalog reward is ALL-OR-NOTHING: under
-- concurrency, if the balance no longer covers the full pointCost the debit must
-- be 0 (never a partial debit) so the free item can be cleanly voided without
-- orphaning points. We add an all-or-nothing mode to redeem_loyalty's points
-- slot. either/or is enforced upstream: an order uses the points slot for the
-- catalog reward OR points-as-₺, never both, so one slot is enough.

-- Replace the 7-arg function with an 8-arg version (adds p_points_exact).
drop function if exists redeem_loyalty(uuid, uuid, uuid, uuid, int, int, int);

create or replace function redeem_loyalty(
  p_customer       uuid,
  p_scope_key      uuid,
  p_restaurant     uuid,
  p_order          uuid,
  p_points         int,
  p_stamps         int,
  p_points_rate    int,
  p_points_exact   boolean default false
) returns table(points_debited int, stamps_debited int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points_bal int;
  v_stamp_bal  int;
  v_pd int := 0;
  v_sd int := 0;
begin
  perform pg_advisory_xact_lock(hashtext(p_customer::text || ':' || p_scope_key::text));

  select coalesce(sum(delta), 0) into v_points_bal
    from loyalty_transactions
    where customer_id = p_customer and scope_key = p_scope_key and type = 'points';
  select coalesce(sum(delta), 0) into v_stamp_bal
    from loyalty_transactions
    where customer_id = p_customer and scope_key = p_scope_key and type = 'stamp';

  -- points: exact (catalog) = all-or-nothing on p_points; else points-as-₺ debit
  -- at most floor(balance/rate)*rate (whole ₺), capped by request.
  if p_points > 0 and v_points_bal > 0 then
    if p_points_exact then
      if v_points_bal >= p_points then v_pd := p_points; else v_pd := 0; end if;
    elsif p_points_rate > 0 then
      v_pd := least(p_points, (v_points_bal / p_points_rate) * p_points_rate);
      if v_pd < 0 then v_pd := 0; end if;
    end if;
  end if;

  -- stamps: all-or-nothing for a full card (stamp-free item; stacks with catalog)
  if p_stamps > 0 and v_stamp_bal >= p_stamps then
    v_sd := p_stamps;
  end if;

  if v_pd > 0 then
    insert into loyalty_transactions
      (customer_id, restaurant_id, scope_key, order_id, type, delta, reason, direction)
    values (p_customer, p_restaurant, p_scope_key, p_order, 'points', -v_pd, 'redeem', 'redeem')
    on conflict (order_id, type, direction) where order_id is not null do nothing;
  end if;

  if v_sd > 0 then
    insert into loyalty_transactions
      (customer_id, restaurant_id, scope_key, order_id, type, delta, reason, direction)
    values (p_customer, p_restaurant, p_scope_key, p_order, 'stamp', -v_sd, 'redeem', 'redeem')
    on conflict (order_id, type, direction) where order_id is not null do nothing;
  end if;

  return query select v_pd, v_sd;
end $$;

-- Service-role only: customers must not call this directly via PostgREST.
revoke execute on function redeem_loyalty(uuid, uuid, uuid, uuid, int, int, int, boolean) from public;
revoke execute on function redeem_loyalty(uuid, uuid, uuid, uuid, int, int, int, boolean) from anon, authenticated;
