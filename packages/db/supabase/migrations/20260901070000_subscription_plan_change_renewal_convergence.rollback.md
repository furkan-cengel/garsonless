# Rollback — subscription plan-change renewal convergence

This migration changes the active webhook and renewal hydration contract, so rollback is a coordinated application rollback rather than an automatic down migration.

1. Pause the billing maintenance scheduler and subscription webhook route.
2. Deploy the preceding application/worker version that calls `record_subscription_payment_success_atomic`.
3. Restore `ingest_subscription_billing_provider_event` and `hydrate_subscription_invoice_from_provider_event` from migrations `20260722030000` and `20260901040000`.
4. Drop `apply_paid_subscription_plan_changes`, `record_subscription_payment_success_with_plan_change_atomic`, and `converge_paid_subscription_plan_change`.
5. Before removing `paid_invoice_id`, `paid_at`, or the paid statuses, reconcile every `paid_pending`/`paid_draining` request and preserve its audit evidence externally.

Never delete paid invoices, provider events, or applied change-request audit rows to force a rollback.
