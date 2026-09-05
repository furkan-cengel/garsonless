# Rollback — terminal subscription cancellation reconciliation

This migration is forward-only in normal operation. If the resolver must be
removed before it has been used, drop only the new service-role RPC:

```sql
drop function if exists public.resolve_subscription_cancellation_target_terminal_reconciliation(
  uuid,uuid,uuid,text,text,timestamptz,text,timestamptz
);
```

Do not revert targets already resolved through authenticated provider evidence.
Their reconciliation snapshots preserve the exact observed terminal status.
