# Rollback note

Do not remove this reconciliation path while any `subscription_refunds` row is
`requires_reconciliation`. Stop the billing maintenance worker first and verify
every affected payment in iyzico Reporting. The resolver performs no provider
money movement; removing it does not undo an already completed refund.
