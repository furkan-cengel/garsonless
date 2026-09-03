# Rollback — period-end subscription cancellation

Forward-fix only after any `scheduled`, `processing`, or
`requires_reconciliation` requests have been resolved. Disable the owner
schedule/undo UI and maintenance cancellation consumer first. Do not drop the
ledger while a provider cancel result is ambiguous; retain rows for audit and
manual reconciliation.
