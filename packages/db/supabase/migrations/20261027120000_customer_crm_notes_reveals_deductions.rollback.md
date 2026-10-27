# Rollback: 20261027120000_customer_crm_notes_reveals_deductions

Adds `customer_notes`, `customer_contact_reveals` and `manual_point_deduction_requests`, the
`loyalty_transactions.manual_deduction_request_id` column, the `customer_belongs_to_restaurant`,
`add_customer_note` and `deduct_customer_points_atomic` RPCs, and redefines
`erase_platform_admin_tenant_privacy_data` so tenant erasure also deletes the new tables.

Down migrations are not used; fix forward. If the dashboard code must be reverted, the new
tables and RPCs can stay: nothing else reads them. Deductions are ordinary `reversal` ledger
rows, so balances stay correct either way; undo a wrong deduction with a manual credit.

Do not drop the new tables while the redefined erasure function references them. To remove
them, first re-run the erasure function from `20260722201000_platform_tenant_privacy_erasure_scope.sql`
in a new migration, then drop `loyalty_transactions.manual_deduction_request_id` (after
confirming no rows use it, or accepting the loss of that link), then the three tables and the
three RPCs.
