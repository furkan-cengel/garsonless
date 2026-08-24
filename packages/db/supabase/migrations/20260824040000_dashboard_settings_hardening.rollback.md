# Dashboard Settings hardening rollback

This migration is additive and has not been applied to production by this change.
Before applying it, validate the migration against a fresh local database and a
staging copy with the same extension set as production.

If rollout must be reversed before any privacy operation or integration-health
consumer depends on the new schema, reverse it in this order:

1. Remove `restaurant_settings_revisions` from `supabase_realtime`, then drop
   `restaurant_settings_revision_after_update` and
   `bump_restaurant_settings_revision()`.
2. Unschedule the `prune-dashboard-security-events` cron job when it exists,
   then drop `prune_dashboard_security_events()`.
3. Drop `consume_dashboard_auth_rate_limit()`,
   `update_restaurant_timezone_cas()`, `mutate_team_member_with_audit()`, `export_owner_tenant_privacy_data()` and
   `request_tenant_privacy_operation()` after the Dashboard deployment has been
   rolled back to code that does not call them.
4. Archive the rows required for audit/compliance review, then drop
   `dashboard_auth_rate_limits`, `restaurant_timezone_requests`, `restaurant_integration_health`,
   `tenant_privacy_operations` and `restaurant_settings_revisions`.

Do not drop `tenant_privacy_operations` after real deletion requests or export
audits exist without privacy/legal approval and an approved retention destination.
Do not run this rollback against production as part of an application deploy;
schema rollback must be a separately reviewed operation with a verified backup.
