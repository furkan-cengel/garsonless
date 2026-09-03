# Rollback: order payment settlement evidence

Do not roll this migration back while order-card checkout is enabled. Restore
the predecessor `attach_order_provider_payment` definition from
`20260730070000_order_refund_ledger.sql` only after disabling new checkouts and
reconciling every provider token accepted during the rollback window.

Rolling back deliberately removes the database comparison between the
provider-reported charge, the reserved checkout amount and the current order
total.
