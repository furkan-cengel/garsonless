-- Forward-fix the environment provisioner to resolve existing secret IDs
-- through Vault's supported decrypted view. Direct reads from the base table
-- are intentionally unavailable to the migration function owner.

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

  select id into v_url_id from vault.decrypted_secrets where name = 'outbox_worker_url';
  if v_url_id is null then
    perform vault.create_secret(p_url, 'outbox_worker_url', 'Scheduled domain outbox Edge Function URL');
  else
    perform vault.update_secret(v_url_id, p_url, 'outbox_worker_url', 'Scheduled domain outbox Edge Function URL');
  end if;

  select id into v_secret_id from vault.decrypted_secrets where name = 'outbox_worker_secret';
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
