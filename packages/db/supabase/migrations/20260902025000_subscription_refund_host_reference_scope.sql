-- iyzico documents refundHostReference/cancelHostReference as bank reference
-- values, not globally unique refund identifiers. Sandbox also reuses the
-- same mock value across unrelated payments. Keep exact Reporting refund IDs
-- unique while indexing bank references in their payment context.

begin;

drop index if exists public.subscription_refunds_provider_ref_idx;

create unique index subscription_refunds_reporting_ref_idx
  on public.subscription_refunds(provider, provider_refund_ref)
  where provider_refund_ref like 'iyzico-reporting-refund:%';

create index subscription_refunds_provider_ref_lookup_idx
  on public.subscription_refunds(provider, provider_payment_id, provider_refund_ref)
  where provider_refund_ref is not null;

commit;
