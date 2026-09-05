begin;

-- A fiscal-document job must never change providers after its first attempt.
-- Unattempted legacy jobs stay unbound and are atomically bound when claimed.
alter table public.accounting_invoice_jobs
  add column provider_name text;

alter table public.accounting_invoice_jobs
  add constraint accounting_invoice_jobs_provider_name_check
  check (provider_name is null or provider_name in ('parasut', 'nilvera'));

update public.accounting_invoice_jobs
set provider_name = 'parasut', updated_at = clock_timestamp()
where attempts > 0
   or provider_contact_ref is not null
   or provider_invoice_ref is not null
   or provider_task_ref is not null
   or provider_document_ref is not null;

drop index if exists public.accounting_invoice_jobs_claim_idx;
create index accounting_invoice_jobs_claim_idx
  on public.accounting_invoice_jobs(provider_name, status, available_at, created_at)
  where status in ('pending', 'retry');

drop function public.claim_accounting_invoice_jobs(text, integer);

create function public.claim_accounting_invoice_jobs(
  p_worker_id text,
  p_provider_name text,
  p_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if char_length(btrim(p_worker_id)) not between 1 and 100
    or p_provider_name not in ('parasut', 'nilvera')
    or p_limit not between 1 and 20 then
    raise exception 'accounting_claim_invalid' using errcode = '22023';
  end if;

  with candidates as (
    select id from public.accounting_invoice_jobs
    where status in ('pending', 'retry')
      and available_at <= clock_timestamp()
      and (locked_at is null or locked_at < clock_timestamp() - interval '15 minutes')
      and (provider_name is null or provider_name = p_provider_name)
    order by available_at, created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.accounting_invoice_jobs job
    set status = 'processing',
        provider_name = coalesce(job.provider_name, p_provider_name),
        locked_at = clock_timestamp(),
        locked_by = btrim(p_worker_id),
        attempts = attempts + 1,
        updated_at = clock_timestamp()
    from candidates candidate
    where job.id = candidate.id
    returning jsonb_build_object(
      'id', job.id,
      'restaurantId', job.restaurant_id,
      'subscriptionInvoiceId', job.subscription_invoice_id,
      'amountMinor', job.amount_minor,
      'currency', job.currency,
      'profile', job.billing_profile_snapshot,
      'attempts', job.attempts,
      'providerName', job.provider_name,
      'providerContactRef', job.provider_contact_ref,
      'providerInvoiceRef', job.provider_invoice_ref,
      'providerTaskRef', job.provider_task_ref,
      'providerDocumentRef', job.provider_document_ref,
      'fiscalDocumentType', job.fiscal_document_type
    ) as row
  )
  select coalesce(jsonb_agg(row), '[]'::jsonb) into v_result from claimed;

  return v_result;
end;
$$;

revoke all on function public.claim_accounting_invoice_jobs(text,text,integer)
  from public, anon, authenticated;
grant execute on function public.claim_accounting_invoice_jobs(text,text,integer)
  to service_role;

comment on column public.accounting_invoice_jobs.provider_name is
  'Provider permanently selected at the first claim; null means the job has never been attempted.';
comment on column public.accounting_invoice_jobs.provider_document_ref is
  'Provider fiscal-document identity; distinct from an asynchronous task identity.';
comment on table public.accounting_invoice_jobs is
  'Service-only provider-bound fiscal document queue; paid subscriptions remain active while jobs retry.';

commit;
