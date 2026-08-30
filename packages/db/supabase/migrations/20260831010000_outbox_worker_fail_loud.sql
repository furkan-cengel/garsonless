-- Keep the scheduled outbox worker observable. Vault values are deliberately
-- provisioned per environment and must never be embedded in a migration. A
-- missing value previously returned NULL, causing pg_cron to report a false
-- successful run while no HTTP request was made.

create or replace function public.configure_outbox_worker_vault(
  p_url text,
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, cron, pg_temp
as $$
declare
  v_url_id uuid;
  v_secret_id uuid;
  v_cron_active boolean;
begin
  if p_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/outbox-worker$' then
    raise exception 'Invalid outbox worker URL' using errcode = '22023';
  end if;

  if length(coalesce(p_secret, '')) < 32 then
    raise exception 'Outbox worker secret must be at least 32 characters' using errcode = '22023';
  end if;

  select id into v_url_id from vault.secrets where name = 'outbox_worker_url' for update;
  if v_url_id is null then
    perform vault.create_secret(p_url, 'outbox_worker_url', 'Scheduled domain outbox Edge Function URL');
  else
    perform vault.update_secret(v_url_id, p_url, 'outbox_worker_url', 'Scheduled domain outbox Edge Function URL');
  end if;

  select id into v_secret_id from vault.secrets where name = 'outbox_worker_secret' for update;
  if v_secret_id is null then
    perform vault.create_secret(p_secret, 'outbox_worker_secret', 'Shared secret for the scheduled domain outbox worker');
  else
    perform vault.update_secret(v_secret_id, p_secret, 'outbox_worker_secret', 'Shared secret for the scheduled domain outbox worker');
  end if;

  select exists (
    select 1 from cron.job
    where jobname = 'domain-outbox-worker-every-minute' and active
  ) into v_cron_active;

  if not v_cron_active then
    raise exception 'Domain outbox cron is not active' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'urlConfigured', true,
    'secretConfigured', true,
    'cronActive', true
  );
end;
$$;

revoke all on function public.configure_outbox_worker_vault(text, text) from public, anon, authenticated;
grant execute on function public.configure_outbox_worker_vault(text, text) to service_role;

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

  if nullif(btrim(v_url), '') is null then
    raise exception 'Missing Vault secret: outbox_worker_url'
      using errcode = 'P0001';
  end if;

  if nullif(btrim(v_secret), '') is null then
    raise exception 'Missing Vault secret: outbox_worker_secret'
      using errcode = 'P0001';
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
