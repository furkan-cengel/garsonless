# Rollback — subscription upcoming invoice reminders

1. Deploy the previous billing-maintenance application/worker version so it no
   longer calls `enqueue_subscription_upcoming_invoice_reminders`.
2. Revoke and drop the RPC:
   `public.enqueue_subscription_upcoming_invoice_reminders(integer,timestamptz)`.
3. Restore `domain_outbox_event_type_check` without `invoice.upcoming` only
   after pending `invoice.upcoming` rows have been delivered or archived.

No subscription, invoice, payment or entitlement row is mutated by this
migration. Already delivered notification rows may be retained as audit history.
