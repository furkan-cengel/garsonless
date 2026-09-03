# Rollback: public split ingress hardening

Rollback should only be performed after public split creation has been disabled,
because older application code does not provide the same atomic idempotency and
active-intent guarantees.

```sql
drop function if exists public.create_split_share_guarded(
  uuid, uuid, uuid, uuid, text, numeric, text, uuid, text, jsonb, integer
);
drop index if exists public.payment_shares_request_id_uidx;
alter table public.payment_shares
  drop column if exists request_fingerprint,
  drop column if exists request_id;
```
