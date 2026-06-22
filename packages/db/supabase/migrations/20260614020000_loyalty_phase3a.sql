-- Üyelik + Sadakat — Phase 3a: points → cart discount (redemption foundation).
-- Adds the earn/redeem `direction` discriminator (so earn + redeem can coexist
-- on one order, each idempotent) and an atomic, double-spend-safe redeem RPC.

-- ─── direction: earn (+delta) vs redeem (-delta) ───────────────────────────────
alter table loyalty_transactions
  add column direction text not null default 'earn'
  check (direction in ('earn', 'redeem'));

-- Replace the (order_id,type) unique key with (order_id,type,direction): an
-- earn-points row and a redeem-points row on the SAME order are now distinct
-- keys, while each side stays idempotent across retries.
drop index if exists loyalty_tx_order_type_uniq;
create unique index loyalty_tx_order_type_dir_uniq
  on loyalty_transactions(order_id, type, direction) where order_id is not null;

-- ─── redeem_loyalty: atomic balance-check + debit (service-role only) ───────────
-- Serializes redemptions per (customer, scope) with a txn-scoped advisory lock,
-- so two concurrent place-orders can never overspend. Debits points in whole-₺
-- multiples (p_points_rate = points per ₺1) so no sub-₺ points are wasted.
-- Stamps are all-or-nothing for a full card (used in 3c; pass 0 in 3a).
create or replace function redeem_loyalty(
  p_customer       uuid,
  p_scope_key      uuid,
  p_restaurant     uuid,
  p_order          uuid,
  p_points         int,
  p_stamps         int,
  p_points_rate    int
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

  -- points: debit at most floor(balance/rate)*rate (whole ₺), capped by request
  if p_points > 0 and p_points_rate > 0 and v_points_bal > 0 then
    v_pd := least(p_points, (v_points_bal / p_points_rate) * p_points_rate);
    if v_pd < 0 then v_pd := 0; end if;
  end if;

  -- stamps: all-or-nothing for a full card
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
revoke execute on function redeem_loyalty(uuid, uuid, uuid, uuid, int, int, int) from public;
revoke execute on function redeem_loyalty(uuid, uuid, uuid, uuid, int, int, int) from anon, authenticated;
