# Rollback note

Drop `finalize_subscription_checkout_with_payment_identity` and
`hydrate_subscription_invoice_with_payment_identity`, restore `service_role`
execute grants on the two predecessor functions, and restore the previous
checkout recovery JSON projections if an application rollback requires them.

This rollback deliberately reopens the crash window where a paid financial
transition can commit before its provider `paymentId` is bound. Do not roll
back while checkout or renewal workers are running; drain them first and run a
provider-to-ledger reconciliation for every transition accepted during the
rollback window.
