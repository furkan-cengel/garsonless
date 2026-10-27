# Rollback: 20261027120100_tenant_erasure_manual_credit_requests

Redefines `erase_platform_admin_tenant_privacy_data` so it unlinks and deletes
`manual_store_credit_requests` before and after the ledger delete. Without it, erasing a tenant that ever granted manual credit fails with
a foreign-key error.

Down migrations are not used; fix forward. Re-running the function body from
`20261027120000_customer_crm_notes_reveals_deductions.sql` restores the previous (failing)
behavior. No data is changed by this migration.
