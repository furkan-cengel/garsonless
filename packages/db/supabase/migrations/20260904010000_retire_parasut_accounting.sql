-- Retire the legacy Paraşüt accounting path after the Nilvera cutover.
-- Historical queue rows remain as audit records; only pristine, never-claimed
-- Paraşüt jobs may be quarantined automatically.

begin;

-- Prevent a worker from changing a row between the safety check and quarantine.
lock table public.accounting_invoice_jobs in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.accounting_invoice_jobs
    where provider_name = 'parasut'
      and not (
        status in ('pending', 'retry')
        and attempts = 0
        and provider_contact_ref is null
        and provider_invoice_ref is null
        and provider_task_ref is null
        and provider_document_ref is null
        and fiscal_document_type is null
        and locked_at is null
        and locked_by is null
        and completed_at is null
        and last_error_code is null
      )
  ) then
    raise exception 'parasut_retirement_requires_manual_review'
      using errcode = 'P0001';
  end if;
end;
$$;

update public.accounting_invoice_jobs
set status = 'failed',
    last_error_code = 'ACCOUNTING_PROVIDER_RETIRED',
    locked_at = null,
    locked_by = null,
    updated_at = clock_timestamp()
where provider_name = 'parasut'
  and status in ('pending', 'retry')
  and attempts = 0
  and provider_contact_ref is null
  and provider_invoice_ref is null
  and provider_task_ref is null
  and provider_document_ref is null
  and fiscal_document_type is null
  and locked_at is null
  and locked_by is null
  and completed_at is null
  and last_error_code is null;

-- Remove the retired provider's credential without reading or logging it.
delete from vault.secrets
where name = 'parasut_refresh_token';

-- Preserve non-secret lease metadata for audit history, but leave no live lock.
update public.accounting_provider_oauth_leases
set locked_at = null,
    locked_by = null,
    updated_at = clock_timestamp()
where provider = 'parasut';

drop function if exists public.initialize_parasut_refresh_token(text);
drop function if exists public.configure_parasut_refresh_token(text);
drop function if exists public.claim_parasut_refresh_token(text, integer);
drop function if exists public.rotate_parasut_refresh_token(text, bigint, text);
drop function if exists public.release_parasut_refresh_token(text, bigint);

create or replace function public.claim_accounting_invoice_jobs(
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
  if char_length(btrim(coalesce(p_worker_id, ''))) not between 1 and 100
    or p_provider_name is distinct from 'nilvera'
    or coalesce(p_limit, 0) not between 1 and 20 then
    raise exception 'accounting_claim_invalid' using errcode = '22023';
  end if;

  with candidates as (
    select id from public.accounting_invoice_jobs
    where status in ('pending', 'retry')
      and available_at <= clock_timestamp()
      and (locked_at is null or locked_at < clock_timestamp() - interval '15 minutes')
      and (provider_name is null or provider_name = 'nilvera')
    order by available_at, created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.accounting_invoice_jobs job
    set status = 'processing',
        provider_name = coalesce(job.provider_name, 'nilvera'),
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

comment on function public.claim_accounting_invoice_jobs(text,text,integer) is
  'Claims fiscal-document jobs only for the active Nilvera provider.';
comment on column public.accounting_invoice_jobs.provider_name is
  'Nilvera is the active provider; Paraşüt values are retained only on historical audit rows.';
comment on table public.accounting_provider_oauth_leases is
  'Historical non-secret OAuth lease metadata; the Paraşüt credential and RPCs are retired.';

commit;
