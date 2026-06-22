-- Payment becomes a column, independent of the kitchen flow.
-- Previously the İyzico callback wrote status='paid', which the kitchen
-- then overwrote when advancing the order — payment info was erased.
-- 'paid' stays in the status CHECK constraint for legacy rows only.

alter table orders add column paid_at timestamptz default null;

update orders set paid_at = coalesce(updated_at, now())
  where status = 'paid';
