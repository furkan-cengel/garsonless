begin;

create function public.resolve_subscription_checkout_reconciliation_after_finalize()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.operation_type = 'checkout.initialize'
    and new.status = 'succeeded'
    and old.status = 'requires_reconciliation' then
    update public.billing_reconciliation_jobs
    set status = 'resolved',
        completed_at = coalesce(new.completed_at, clock_timestamp()),
        locked_at = null,
        locked_by = null,
        discrepancy_code = null,
        last_error = null,
        local_snapshot = local_snapshot || jsonb_build_object(
          'subscriptionId', new.subscription_id,
          'invoiceId', new.invoice_id,
          'resolvedBy', 'authenticated_checkout_retrieve'
        )
    where dedupe_key = 'provider-operation:' || new.id
      and status <> 'resolved';
  end if;
  return new;
end;
$$;

create trigger resolve_subscription_checkout_reconciliation_after_finalize
  after update of status on public.billing_provider_operations
  for each row
  execute function public.resolve_subscription_checkout_reconciliation_after_finalize();

-- Close historical checkout jobs only when the succeeded operation is bound
-- to its exact fully-paid invoice. No payment or entitlement state is inferred.
update public.billing_reconciliation_jobs job
set status = 'resolved',
    completed_at = coalesce(operation.completed_at, clock_timestamp()),
    locked_at = null,
    locked_by = null,
    discrepancy_code = null,
    last_error = null,
    local_snapshot = job.local_snapshot || jsonb_build_object(
      'subscriptionId', operation.subscription_id,
      'invoiceId', operation.invoice_id,
      'resolvedBy', 'authenticated_checkout_retrieve_backfill'
    )
from public.billing_provider_operations operation
join public.subscription_invoices invoice
  on invoice.id = operation.invoice_id
 and invoice.restaurant_id = operation.restaurant_id
 and invoice.subscription_id = operation.subscription_id
where job.dedupe_key = 'provider-operation:' || operation.id
  and job.status <> 'resolved'
  and operation.operation_type = 'checkout.initialize'
  and operation.status = 'succeeded'
  and invoice.status = 'paid'
  and invoice.amount_paid_minor = invoice.amount_due_minor;

comment on function public.resolve_subscription_checkout_reconciliation_after_finalize() is
  'Closes only the exact checkout provider-operation reconciliation after authenticated paid-invoice finalization succeeds.';

revoke all on function public.resolve_subscription_checkout_reconciliation_after_finalize()
  from public, anon, authenticated;

commit;
