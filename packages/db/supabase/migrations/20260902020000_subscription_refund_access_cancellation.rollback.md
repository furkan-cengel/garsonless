# Rollback note

This migration is forward-only because it locks access and creates auditable provider-cancellation work for already completed refunds. Do not delete refund or cancellation records.

If deployment must be halted, stop the billing-maintenance worker first, keep `refund_cancel_pending` fail-closed, and deploy a corrective migration. Any provider target already claimed is ambiguous until reconciled; never blindly retry it.
