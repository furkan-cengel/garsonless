-- DEV only. The runner must assert project yxsegwkzyiscrxiwdeuf.
-- Every fixture change is rolled back; no provider or email requests are made.
begin;
do $$
declare
  v_id uuid;
  v_ref text;
  v_job public.accounting_invoice_jobs%rowtype;
  v_code text;
begin
  select id, provider_invoice_ref into v_id, v_ref
  from public.accounting_invoice_jobs where provider_name = 'nilvera'
  order by created_at limit 1 for update;
  if v_id is null then raise exception 'DEV accounting fixture required'; end if;

  foreach v_code in array array['ACCOUNTING_TASK_PENDING', 'ACCOUNTING_DOCUMENT_PENDING'] loop
    update public.accounting_invoice_jobs
    set status = 'processing', attempts = 1, locked_by = 'pending-poll-test', locked_at = clock_timestamp()
    where id = v_id;
    if public.fail_accounting_invoice_job(v_id, 'wrong-worker', v_code, true) then
      raise exception 'Foreign worker changed the job';
    end if;
    for i in 1..30 loop
      perform public.fail_accounting_invoice_job(v_id, 'pending-poll-test', v_code, true);
      select * into v_job from public.accounting_invoice_jobs where id = v_id;
      if v_job.status <> 'retry' or v_job.attempts <> 0
        or v_job.locked_by is not null or v_job.locked_at is not null
        or v_job.available_at not between clock_timestamp() + interval '55 seconds' and clock_timestamp() + interval '65 seconds'
        or v_job.provider_invoice_ref is distinct from v_ref then
        raise exception 'Pending polling regression';
      end if;
      update public.accounting_invoice_jobs set status = 'processing', attempts = attempts + 1,
        locked_by = 'pending-poll-test', locked_at = clock_timestamp() where id = v_id;
    end loop;
  end loop;

  update public.accounting_invoice_jobs set attempts = 2 where id = v_id;
  perform public.fail_accounting_invoice_job(v_id, 'pending-poll-test', 'NILVERA_API_TEMPORARY', true);
  select * into v_job from public.accounting_invoice_jobs where id = v_id;
  if v_job.status <> 'retry' or v_job.attempts <> 2
    or v_job.available_at not between clock_timestamp() + interval '19 minutes' and clock_timestamp() + interval '21 minutes' then
    raise exception 'Real API failure backoff changed';
  end if;
  update public.accounting_invoice_jobs set status = 'processing', attempts = 25, locked_by = 'pending-poll-test' where id = v_id;
  perform public.fail_accounting_invoice_job(v_id, 'pending-poll-test', 'NILVERA_API_TEMPORARY', true);
  if (select status from public.accounting_invoice_jobs where id = v_id) <> 'failed' then
    raise exception 'Error retry limit changed';
  end if;
  update public.accounting_invoice_jobs set status = 'processing', attempts = 1, locked_by = 'pending-poll-test' where id = v_id;
  perform public.fail_accounting_invoice_job(v_id, 'pending-poll-test', 'NILVERA_DOCUMENT_FAILED', false);
  if (select status from public.accounting_invoice_jobs where id = v_id) <> 'failed' then
    raise exception 'Permanent provider failure retried';
  end if;
end;
$$;
rollback;
