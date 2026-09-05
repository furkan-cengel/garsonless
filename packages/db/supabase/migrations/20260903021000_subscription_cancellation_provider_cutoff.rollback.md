# Rollback note

Drain billing maintenance, restore the predecessor claim/completion RPC grants,
drop the three new RPCs and cutoff trigger, then remove the two added columns
and restore the prior status/state constraints and indexes.

Rows already in `provider_cancelled` cannot be represented by the old state
machine. Before rollback, either let `apply_due_subscription_cancellation_access`
apply them at `effective_at`, or move each row to
`requires_reconciliation` with an operator-reviewed record. Restoring the old
worker reintroduces the renewal-versus-cancel race at the exact period boundary.
