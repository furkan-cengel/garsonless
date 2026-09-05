# Rollback notes

This migration is forward-only after lifecycle events or fiscal delivery receipts exist.

- Disable the billing-maintenance and outbox schedulers first.
- Deploy application/worker code that no longer emits or consumes the new event types.
- Preserve `notification_deliveries` and `notification_delivery_provider_events` as audit evidence; do not delete sent/bounced/complained records.
- Reverting the outbox/category constraints is safe only after proving no rows use `onboarding`, `lifecycle`, trial reminder, trial expiry, or `fiscal_document.ready` values.
- The previous `complete_accounting_invoice_job` body may be restored only if fiscal-document outbox delivery is intentionally retired.
