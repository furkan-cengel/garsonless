# Subscription checkout gross amounts rollback

This migration corrects an accounting contract: Masabu list prices are net,
while iyzico subscription pricing plans, provider operations and invoices use
the KDV-inclusive gross amount.

Do not roll it back while checkout operations created by this version are
pending or awaiting callback. First stop new checkout, reconcile every pending
provider operation, and deploy application/provider configuration that agrees
on the previous amount contract. Then restore the prior function body from
`20260814090000_plan_catalog_v2.sql`.

Never edit existing provider pricing plans or paid invoices during rollback.
