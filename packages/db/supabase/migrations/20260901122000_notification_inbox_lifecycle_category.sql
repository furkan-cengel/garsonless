-- Keep the durable inbox category vocabulary aligned with notification
-- templates, delivery receipts and the domain preference contract.

begin;

alter table public.notification_inbox
  drop constraint if exists notification_inbox_category_check;
alter table public.notification_inbox
  add constraint notification_inbox_category_check
    check (category in ('order', 'service_request', 'lifecycle', 'billing', 'system'));

commit;
