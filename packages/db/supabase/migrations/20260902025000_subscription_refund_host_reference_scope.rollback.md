# Rollback — refund host-reference scope

Before restoring global uniqueness, first verify that no bank reference is
reused across payments. If duplicates exist, restoring the old index will fail
and would reintroduce the production defect.

```sql
drop index if exists public.subscription_refunds_provider_ref_lookup_idx;
drop index if exists public.subscription_refunds_reporting_ref_idx;

create unique index subscription_refunds_provider_ref_idx
  on public.subscription_refunds(provider, provider_refund_ref)
  where provider_refund_ref is not null;
```
