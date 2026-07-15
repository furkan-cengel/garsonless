-- Invoke the Edge outbox worker every minute without embedding environment
-- credentials in migrations or cron.job.command. Each environment provisions
-- `outbox_worker_url` and `outbox_worker_secret` in Supabase Vault.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_domain_outbox_worker()
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'outbox_worker_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'outbox_worker_secret';

  if nullif(btrim(v_url), '') is null or nullif(btrim(v_secret), '') is null then
    raise warning 'Outbox worker Vault configuration is missing';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-outbox-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.invoke_domain_outbox_worker() from public, anon, authenticated;
grant execute on function public.invoke_domain_outbox_worker() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'domain-outbox-worker-every-minute';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'domain-outbox-worker-every-minute',
    '* * * * *',
    'select public.invoke_domain_outbox_worker();'
  );
end;
$$;
