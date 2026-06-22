-- Sprint 19a — loyalty refund on cancelled orders.
-- Adds a third ledger direction, `refund`, so cancellation reversals add back
-- spendable balance without inflating lifetime earn points. Existing
-- `(order_id, type, direction)` idempotency naturally gives one refund row per
-- order/type.

alter table public.loyalty_transactions
  drop constraint if exists loyalty_transactions_direction_check;

alter table public.loyalty_transactions
  add constraint loyalty_transactions_direction_check
  check (direction in ('earn', 'redeem', 'refund'));

create or replace function public.refund_cancelled_loyalty(
  p_order uuid
) returns table(type text, refunded int)
language sql
security definer
set search_path = public
as $$
  with redeem_rows as (
    select
      customer_id,
      restaurant_id,
      scope_key,
      order_id,
      type,
      greatest(0, -sum(delta)::int) as amount
    from public.loyalty_transactions
    where order_id = p_order
      and direction = 'redeem'
      and delta < 0
      and type in ('points', 'stamp')
    group by customer_id, restaurant_id, scope_key, order_id, type
  ),
  locked as (
    select r.*
    from redeem_rows r
    join lateral (
      select pg_advisory_xact_lock(hashtext(r.customer_id::text || ':' || r.scope_key::text))
    ) lock_row on true
    where r.amount > 0
  ),
  inserted as (
    insert into public.loyalty_transactions
      (customer_id, restaurant_id, scope_key, order_id, type, delta, reason, direction)
    select
      customer_id, restaurant_id, scope_key, order_id, type, amount, 'refund_cancel', 'refund'
    from locked
    on conflict (order_id, type, direction) where order_id is not null do nothing
    returning type, delta
  )
  select inserted.type, inserted.delta as refunded
  from inserted;
$$;

revoke execute on function public.refund_cancelled_loyalty(uuid) from public;
revoke execute on function public.refund_cancelled_loyalty(uuid) from anon, authenticated;
