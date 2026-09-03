# Rollback — rename terminal cancellation RPC

If the short RPC name must be reverted before use, rename it back to the exact
63-byte PostgreSQL identifier created by the earlier migration:

```sql
alter function public.resolve_subscription_cancellation_target_terminal(
  uuid,uuid,uuid,text,text,timestamptz,text,timestamptz
) rename to resolve_subscription_cancellation_target_terminal_reconciliatio;

notify pgrst, 'reload schema';
```
