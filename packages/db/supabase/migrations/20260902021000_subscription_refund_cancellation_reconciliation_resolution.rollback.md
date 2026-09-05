# Rollback

Forward-only production rollback is intentionally not automated. If the
resolution RPC must be disabled, revoke its `service_role` execute grant in a
new migration. Existing resolved cancellation evidence and final subscription
states must remain immutable.
