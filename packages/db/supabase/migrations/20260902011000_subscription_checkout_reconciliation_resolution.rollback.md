# Rollback notes

Dropping the trigger is mechanically safe, but do not reopen reconciliation
jobs already resolved by authenticated checkout evidence. If this behavior must
be removed, deploy a forward migration that drops
`resolve_subscription_checkout_reconciliation_after_finalize` while retaining
the historical resolution audit stored in each job's `local_snapshot`.
