# Rollback

1. Drop `public.read_subscription_billing_settings(uuid)`.
2. Rename `public.read_subscription_billing_settings_before_pending_projection(uuid)` back to `read_subscription_billing_settings`.
3. Revoke execution from `public`, `anon`, and `authenticated`; grant execution to `service_role`.

The migration changes only the owner-facing pending-checkout projection. It does not delete or rewrite provider operation, subscription, invoice, or payment data.
