begin;

-- Jobs already present at provider cutover belong to the legacy Paraşüt
-- lineage. Binding them prevents a newly selected provider from claiming an
-- old invoice implicitly. Jobs inserted after this migration remain unbound
-- until their first provider-specific claim.
update public.accounting_invoice_jobs
set provider_name = 'parasut',
    updated_at = clock_timestamp()
where provider_name is null;

comment on column public.accounting_invoice_jobs.provider_name is
  'Provider permanently selected at first claim; pre-cutover jobs are explicitly bound to Paraşüt.';

commit;
