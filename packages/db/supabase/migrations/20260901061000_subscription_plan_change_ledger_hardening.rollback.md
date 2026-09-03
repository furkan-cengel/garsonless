# Rollback — plan change ledger hardening

Drop `resolve_subscription_change_reconciliation_after_schedule` and its
trigger. Restoring the original restrictive circular FK is not recommended;
if required, first prove there are no cleanup/retention jobs that delete
provider operations independently from change-request audit rows.

Rollback does not reopen reconciliation jobs already resolved by an exact
provider result. Reopen those only through an audited operator decision.
