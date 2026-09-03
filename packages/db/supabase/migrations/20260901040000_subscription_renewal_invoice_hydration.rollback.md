# Rollback — subscription renewal invoice hydration

Do not automatically roll this migration back after it has hydrated provider
orders. Disable the billing maintenance worker, keep webhook ingestion durable,
and ship corrections as a forward migration. Paid/past-due invoices, payment
attempts, dunning runs, outbox events, and period projections must be reconciled
against iyzico before any manual change.
