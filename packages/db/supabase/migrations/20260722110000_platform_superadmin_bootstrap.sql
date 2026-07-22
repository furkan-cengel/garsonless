-- One-time, atomic bootstrap for the first Masabu platform owner.
-- Additional admins and later role changes belong to the audited admin command
-- surface; this RPC cannot be used after the first identity exists.

create or replace function public.bootstrap_platform_superadmin(
  p_user_id uuid,
  p_display_name text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_existing public.platform_admin_users%rowtype;
begin
  if p_user_id is null
    or char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000
    or p_request_id is null
  then
    raise exception 'invalid platform superadmin bootstrap input' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'platform superadmin auth identity not found' using errcode = '23503';
  end if;

  lock table public.platform_admin_users in exclusive mode;
  select * into v_existing from public.platform_admin_users where user_id = p_user_id;
  if found then
    if v_existing.role = 'superadmin' and v_existing.status = 'active' then
      return jsonb_build_object('userId', v_existing.user_id, 'duplicate', true);
    end if;
    raise exception 'platform admin identity already exists with another state' using errcode = '23505';
  end if;
  if exists (select 1 from public.platform_admin_users) then
    raise exception 'platform owner already bootstrapped' using errcode = '23505';
  end if;

  insert into public.platform_admin_users (
    user_id, role, status, display_name, activated_at
  ) values (
    p_user_id, 'superadmin', 'active', btrim(p_display_name), now()
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_user_id, 'superadmin', 'platform_admin.bootstrap', 'platform_admin_user', p_user_id::text,
    btrim(p_reason), p_request_id, null,
    jsonb_build_object('role', 'superadmin', 'status', 'active')
  );

  return jsonb_build_object('userId', p_user_id, 'duplicate', false);
end;
$$;

revoke all on function public.bootstrap_platform_superadmin(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_platform_superadmin(uuid, text, text, uuid) to service_role;
