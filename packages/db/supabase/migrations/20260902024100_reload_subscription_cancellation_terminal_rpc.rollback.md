# Rollback — reload terminal cancellation RPC schema cache

No rollback is required. This migration only asks PostgREST to reload its schema
cache and does not change schema or billing data.
