-- Align pg_net with the dashboard route's bounded 60-second execution window.

create or replace function public.invoke_accounting_invoice_worker()
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
  where name = 'accounting_worker_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'accounting_worker_secret';

  if nullif(btrim(v_url), '') is null then
    raise exception 'Missing Vault secret: accounting_worker_url' using errcode = 'P0001';
  end if;
  if nullif(btrim(v_secret), '') is null then
    raise exception 'Missing Vault secret: accounting_worker_secret' using errcode = 'P0001';
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.invoke_accounting_invoice_worker()
  from public, anon, authenticated;
grant execute on function public.invoke_accounting_invoice_worker() to service_role;
