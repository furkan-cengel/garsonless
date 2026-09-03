# Subscription checkout validation codes rollback

This migration changes only customer-safe database error categories and repeats
the KDV-inclusive amount contract from the preceding migration. To roll it back,
restore the function body from
`20260831040000_subscription_checkout_gross_amounts.sql`. No table data changes
are required.
