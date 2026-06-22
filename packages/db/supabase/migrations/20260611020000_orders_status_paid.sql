-- The İyzico payment callback sets orders.status = 'paid', but the original
-- check constraint doesn't include it — the update was being rejected.
alter table orders drop constraint orders_status_check;

alter table orders add constraint orders_status_check
  check (status in (
    'pending', 'pending_approval', 'sent_to_kitchen',
    'preparing', 'ready', 'served', 'paid', 'cancelled'
  ));
