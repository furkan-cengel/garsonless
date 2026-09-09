begin;

-- A Nilvera document awaiting GIB processing is not a failed API request.
-- Poll existing documents at the worker cadence without spending error retries.
create or replace function public.fail_accounting_invoice_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_retryable boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending boolean := p_retryable and p_error_code in (
    'ACCOUNTING_TASK_PENDING', 'ACCOUNTING_DOCUMENT_PENDING'
  );
begin
  if char_length(btrim(p_error_code)) not between 1 and 100 then
    raise exception 'accounting_failure_code_invalid' using errcode = '22023';
  end if;
  update public.accounting_invoice_jobs set
    status = case when v_pending or (p_retryable and attempts < 25) then 'retry' else 'failed' end,
    attempts = case when v_pending then greatest(0, attempts - 1) else attempts end,
    available_at = case
      when v_pending then clock_timestamp() + interval '1 minute'
      when p_retryable then clock_timestamp() + make_interval(mins => least(360, attempts * attempts * 5))
      else available_at
    end,
    locked_at = null, locked_by = null,
    last_error_code = btrim(p_error_code), updated_at = clock_timestamp()
  where id = p_job_id and status = 'processing' and locked_by = btrim(p_worker_id);
  return found;
end;
$$;

revoke all on function public.fail_accounting_invoice_job(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.fail_accounting_invoice_job(uuid,text,text,boolean) to service_role;

-- Bring only already-pending provider documents back to the next polling cycle.
-- Keep their fiscal identities intact so retries never create a second invoice.
update public.accounting_invoice_jobs
set available_at = least(available_at, clock_timestamp() + interval '1 minute'),
    updated_at = clock_timestamp()
where status = 'retry'
  and last_error_code in ('ACCOUNTING_TASK_PENDING', 'ACCOUNTING_DOCUMENT_PENDING')
  and provider_name = 'nilvera'
  and provider_invoice_ref is not null
  and locked_by is null;

commit;
