# Rollback notes

This migration only replaces `prepare_subscription_checkout_with_add_ons_operation`.

Do not restore the immediately preceding `20260901090000` function body: it
references the nonexistent `billing_provider_operations.expected_provider_plan_ref`
column and makes every add-on checkout fail before provider dispatch.

If rollback is unavoidable, restore the compatible function body from
`20260824050000_subscription_checkout_add_ons.sql`, then reapply the expanded
Starter/Plus/Pro add-on compatibility and exact catalogue checks before enabling
add-on checkout traffic.
