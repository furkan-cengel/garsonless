begin;

-- Iyzico identifies the payer, not the tenant, with customerReferenceCode.
-- The same owner can therefore receive the same provider customer reference
-- for subscriptions belonging to different restaurants. Tenant ownership is
-- still enforced by billing_customers.restaurant_id and every money/access
-- transition resolves the globally unique provider subscription reference.
alter table public.billing_customers
  drop constraint if exists billing_customers_provider_provider_customer_ref_key;

create index if not exists billing_customers_provider_customer_ref_idx
  on public.billing_customers(provider, provider_customer_ref)
  where provider_customer_ref is not null;

comment on column public.billing_customers.provider_customer_ref is
  'Provider payer reference; may be shared by multiple restaurant-scoped billing customers owned by the same payer.';

commit;
