-- Re-evaluate pre-existing accounting jobs against the complete Paraşüt
-- address contract. The provider is not called here; ready jobs merely return
-- to the durable queue and retain their unique subscription_invoice_id.

begin;

update public.accounting_invoice_jobs job
set billing_profile_snapshot = job.billing_profile_snapshot || jsonb_build_object(
      'legalName', customer.legal_name,
      'name', customer.contact_name,
      'surname', customer.contact_surname,
      'identityNumber', customer.identity_number,
      'taxOffice', customer.billing_address->>'taxOffice',
      'email', customer.contact_email,
      'billingAddress', customer.billing_address,
      'periodStart', invoice.period_start,
      'periodEnd', invoice.period_end,
      'paidAt', invoice.paid_at,
      'plan', invoice.plan,
      'addOns', invoice.add_ons,
      'billingInterval', invoice.billing_interval
    ),
    status = case
      when job.status = 'needs_profile'
        and invoice.paid_at is not null
        and coalesce(char_length(btrim(customer.legal_name)), 0) > 0
        and coalesce(char_length(btrim(customer.identity_number)), 0) in (10, 11)
        and coalesce(char_length(btrim(customer.billing_address->>'taxOffice')), 0) > 0
        and coalesce(char_length(btrim(customer.billing_address->>'address')), 0) > 0
        and coalesce(char_length(btrim(customer.billing_address->>'city')), 0) > 0
        and coalesce(char_length(btrim(customer.billing_address->>'district')), 0) > 0
        and coalesce(char_length(btrim(customer.contact_email)), 0) > 0
      then 'pending'
      else job.status
    end,
    available_at = case
      when job.status = 'needs_profile'
        and invoice.paid_at is not null
        and coalesce(char_length(btrim(customer.legal_name)), 0) > 0
        and coalesce(char_length(btrim(customer.identity_number)), 0) in (10, 11)
        and coalesce(char_length(btrim(customer.billing_address->>'taxOffice')), 0) > 0
        and coalesce(char_length(btrim(customer.billing_address->>'address')), 0) > 0
        and coalesce(char_length(btrim(customer.billing_address->>'city')), 0) > 0
        and coalesce(char_length(btrim(customer.billing_address->>'district')), 0) > 0
        and coalesce(char_length(btrim(customer.contact_email)), 0) > 0
      then clock_timestamp()
      else job.available_at
    end,
    last_error_code = case when job.status = 'needs_profile' then null else job.last_error_code end,
    updated_at = clock_timestamp()
from public.subscription_invoices invoice
join public.billing_subscriptions subscription
  on subscription.id = invoice.subscription_id
  and subscription.restaurant_id = invoice.restaurant_id
join public.billing_customers customer
  on customer.id = subscription.billing_customer_id
  and customer.restaurant_id = subscription.restaurant_id
where invoice.id = job.subscription_invoice_id
  and invoice.restaurant_id = job.restaurant_id
  and job.status in ('needs_profile', 'pending', 'retry');

commit;
