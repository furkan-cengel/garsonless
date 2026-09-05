# Rollback notes — subscription refund ledger

This migration creates financial evidence and is not safely reversible after a
refund has been dispatched. Before any rollback, disable refund initiation and
the billing maintenance entrypoint, then reconcile every row in
`subscription_refunds` with iyzico and accounting.

If no refund was dispatched, restore `read_subscription_billing_settings(uuid)`
from `read_subscription_billing_settings_before_refund_ledger(uuid)`, drop the
three refund RPCs and `bind_subscription_payment_provider_id`, drop
`subscription_refunds`, remove the payment identity column/index, and restore
the previous provider-operation and outbox constraints from migration 1000.

Never delete succeeded or reconciliation-required refund evidence. In that
case use a forward migration that preserves the ledger and provider references.
