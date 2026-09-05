# Rollback — subscription checkout payment evidence

This migration intentionally has no automatic down migration. It changes the
financial authority boundary and may create paid invoices, payment attempts,
outbox events, and add-on entitlements in one transaction.

If deployment must be rolled back:

1. Disable SaaS checkout and checkout-recovery workers.
2. Keep webhook ingestion enabled so provider events remain durable.
3. Deploy the prior application version only after disabling calls to
   `finalize_subscription_checkout_operation`.
4. Do not restore the former operation-status add-on trigger.
5. Reconcile every `checkout-unpaid:*` job and every checkout completed during
   the deployment window against iyzico before changing financial rows.
6. Ship a new forward migration for any schema/function correction.

Never infer `paid` from a browser callback or from
`billing_provider_operations.status = 'succeeded'`.
