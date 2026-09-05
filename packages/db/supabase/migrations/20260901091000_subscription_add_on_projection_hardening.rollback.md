# Rollback — subscription add-on projection hardening

Forward-fix only. Reverting would restore a projection that can return SQL
`NULL` when an active subscription has no scheduled change. If rollback is
unavoidable, replace `read_subscription_billing_settings(uuid)` with the
version from migration `20260901090000` only after retaining its explicit
`v_scheduled_add_ons := coalesce(..., '{}'::text[])` guard.
