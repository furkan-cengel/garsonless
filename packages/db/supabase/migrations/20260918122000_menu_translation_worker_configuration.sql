-- Service-only provisioning; no secret value is returned to the caller.
create function public.configure_menu_translation_worker_vault(p_url text,p_secret text)
returns jsonb language plpgsql security definer set search_path=public,vault,cron,pg_temp as $$
declare url_id uuid; secret_id uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_url is null or p_url not in (
  'https://yxsegwkzyiscrxiwdeuf.supabase.co/functions/v1/menu-translation-worker',
  'https://svxvloeosiksqfadgkvo.supabase.co/functions/v1/menu-translation-worker'
 ) then raise exception 'invalid_worker_url' using errcode='22023'; end if;
 if char_length(coalesce(p_secret,'')) not between 32 and 256 then raise exception 'invalid_worker_secret' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('menu-translation-worker-configuration',0));
 select id into url_id from vault.secrets where name='menu_translation_worker_url';
 select id into secret_id from vault.secrets where name='menu_translation_worker_secret';
 if url_id is null then
  perform vault.create_secret(p_url,'menu_translation_worker_url','Scheduled QR menu translation worker');
 else perform vault.update_secret(url_id,p_url,'menu_translation_worker_url'); end if;
 if secret_id is null then
  perform vault.create_secret(p_secret,'menu_translation_worker_secret','QR menu translation worker authentication');
 else perform vault.update_secret(secret_id,p_secret,'menu_translation_worker_secret'); end if;
 return jsonb_build_object('configured',true,'cronScheduled',exists(select 1 from cron.job where jobname='menu-translation-worker-every-minute' and active));
end $$;
revoke all on function public.configure_menu_translation_worker_vault(text,text) from public,anon,authenticated;
grant execute on function public.configure_menu_translation_worker_vault(text,text) to service_role;
