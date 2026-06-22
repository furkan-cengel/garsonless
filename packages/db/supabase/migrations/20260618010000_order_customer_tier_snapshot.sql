-- Sprint 17c: snapshot the member tier that applied when an order was placed.
-- This is operational/audit data for owner and kitchen surfaces. It is
-- intentionally NOT added to the anon column grant from the security hardening
-- migration, so public menu clients cannot read customer tier classification.

alter table public.orders
  add column if not exists customer_tier jsonb;

comment on column public.orders.customer_tier is
  'Order-time loyalty tier snapshot used for priority service display/sorting.';

create index if not exists orders_customer_tier_priority_idx
  on public.orders (restaurant_id, ((customer_tier->>'priorityService')), created_at)
  where customer_tier is not null;
