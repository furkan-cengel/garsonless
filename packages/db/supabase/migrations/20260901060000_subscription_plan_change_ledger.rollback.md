# Rollback — subscription plan change ledger

Pause billing maintenance and disable plan-change UI/provider dispatch first.
Resolve or cancel all `processing`, `scheduled` and `requires_reconciliation`
change requests; never delete their provider audit evidence while an iyzico
child subscription may still renew.

After provider/local convergence, drop the two plan-change RPCs and triggers,
remove `subscription.change` from the provider-operation contract, then archive
and drop `subscription_change_requests` and
`billing_subscription_provider_refs`. Restore the previous outbox allowlist
only after pending plan notification events are delivered or archived.

This rollback cannot undo an upgrade already accepted by iyzico; that requires
an explicit compensating provider plan change and reconciliation.
