-- Explicitly audited, superadmin-only owner/team and billing contact access.
-- Auth unbans use the supported Auth Admin API, never SQL writes to auth.users.
create table public.platform_account_unlocks (
  request_id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  actor_user_id uuid not null references public.platform_admin_users(user_id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null check (status in ('pending', 'completed', 'failed')),
  previous_banned_until timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index platform_account_unlocks_pending_user on public.platform_account_unlocks(user_id) where status = 'pending';
alter table public.platform_account_unlocks enable row level security;
revoke all on public.platform_account_unlocks from public, anon, authenticated;
grant select on public.platform_account_unlocks to service_role;

create function public.assert_platform_account_admin(p_actor_user_id uuid, p_actor_role text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.platform_admin_users
  where user_id = p_actor_user_id and status = 'active' and role = 'superadmin' and role = p_actor_role
  for update;
  if not found then raise exception 'platform_accounts_not_authorized' using errcode = '42501'; end if;
end;
$$;

create function public.reveal_platform_admin_tenant_accounts(
  p_restaurant_id uuid, p_actor_user_id uuid, p_actor_role text, p_reason text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid; v_accounts jsonb; v_billing jsonb;
begin
  perform public.assert_platform_account_admin(p_actor_user_id, p_actor_role);
  if p_request_id is null or char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_accounts_invalid_input' using errcode = '22023';
  end if;
  select owner_id into v_owner from public.restaurants where id = p_restaurant_id and deleted_at is null;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;

  with subjects as (
    select v_owner as user_id, null::uuid as member_id, 'owner'::text as role, 'active'::text as status,
      null::text as invite_email, '[]'::jsonb as permissions, null::timestamptz as invited_at, null::timestamptz as accepted_at
    union all
    select m.user_id, m.id, 'staff', m.status, m.email, m.permissions, m.invited_at, m.accepted_at
    from public.restaurant_members m where m.restaurant_id = p_restaurant_id and m.user_id is distinct from v_owner
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', s.user_id, 'memberId', s.member_id, 'role', s.role, 'membershipStatus', s.status,
    'email', coalesce(nullif(u.email, ''), s.invite_email),
    'name', coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), nullif(u.raw_user_meta_data->>'display_name', '')),
    'phone', coalesce(nullif(u.phone, ''), nullif(u.raw_user_meta_data->>'phone', '')), 'createdAt', coalesce(u.created_at, s.invited_at), 'acceptedAt', s.accepted_at,
    'lastSignInAt', u.last_sign_in_at, 'emailConfirmedAt', u.email_confirmed_at,
    'bannedUntil', u.banned_until, 'isBanned', coalesce(u.banned_until > now(), false),
    'isDeleted', (s.user_id is not null and (u.id is null or u.deleted_at is not null)),
    'isPlatformAdmin', exists(select 1 from public.platform_admin_users a where a.user_id = s.user_id and a.status <> 'revoked'),
    'permissions', s.permissions,
    'pendingUnlockRequestId', (select x.request_id from public.platform_account_unlocks x where x.user_id = s.user_id and x.restaurant_id = p_restaurant_id and x.status = 'pending')
  ) order by case when s.role = 'owner' then 0 else 1 end, s.invited_at, s.member_id), '[]'::jsonb)
  into v_accounts from subjects s left join auth.users u on u.id = s.user_id;

  select jsonb_build_object(
    'legalName', b.legal_name, 'email', b.contact_email,
    'name', nullif(btrim(concat_ws(' ', b.contact_name, b.contact_surname)), ''),
    'phone', b.gsm_number, 'identityNumber', b.identity_number,
    'address', b.billing_address->>'address', 'city', b.billing_address->>'city',
    'district', b.billing_address->>'district', 'country', b.billing_address->>'country',
    'zipCode', b.billing_address->>'zipCode', 'taxOffice', b.billing_address->>'taxOffice'
  ) into v_billing from public.billing_customers b where b.restaurant_id = p_restaurant_id;

  -- Never duplicate the revealed personal data in the audit payload.
  insert into public.platform_admin_audit_log(actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values(p_actor_user_id, p_actor_role, 'tenant.accounts.reveal', 'restaurant', p_restaurant_id::text, btrim(p_reason), p_request_id,
    '{}'::jsonb, jsonb_build_object('accountCount', jsonb_array_length(v_accounts), 'billingIncluded', v_billing is not null))
  on conflict do nothing;
  return jsonb_build_object('restaurantId', p_restaurant_id, 'accounts', v_accounts, 'billing', v_billing);
end;
$$;

create function public.reactivate_platform_admin_tenant_member(
  p_restaurant_id uuid, p_member_id uuid, p_actor_user_id uuid, p_actor_role text, p_reason text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_member public.restaurant_members%rowtype; v_result jsonb;
begin
  perform public.assert_platform_account_admin(p_actor_user_id, p_actor_role);
  if p_request_id is null or char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_accounts_invalid_input' using errcode = '22023';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id and deleted_at is null for update;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;
  select * into v_member from public.restaurant_members where id = p_member_id and restaurant_id = p_restaurant_id for update;
  if not found or v_member.user_id is null or v_member.accepted_at is null then
    raise exception 'platform_member_not_actionable' using errcode = '22023';
  end if;
  perform 1 from auth.users where id = v_member.user_id and deleted_at is null;
  if not found then raise exception 'platform_member_not_actionable' using errcode = '22023'; end if;
  select after_state into v_result from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id and request_id = p_request_id and action = 'tenant.member.reactivate'
    and target_type = 'restaurant_member' and target_id = p_member_id::text;
  if found then return v_result; end if;
  if v_member.status not in ('disabled', 'active') then raise exception 'platform_member_not_actionable' using errcode = '22023'; end if;
  -- Preserve the existing permissions; do not accept a pending invitation or grant ownership.
  update public.restaurant_members set status = 'active' where id = p_member_id;
  v_result := jsonb_build_object('requestId', p_request_id, 'status', 'completed');
  insert into public.platform_admin_audit_log(actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values(p_actor_user_id, p_actor_role, 'tenant.member.reactivate', 'restaurant_member', p_member_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object('restaurantId', p_restaurant_id, 'status', v_member.status, 'permissions', v_member.permissions),
    v_result || jsonb_build_object('restaurantId', p_restaurant_id, 'membershipStatus', 'active', 'permissions', v_member.permissions));
  return v_result;
end;
$$;

create function public.prepare_platform_admin_user_unban(
  p_restaurant_id uuid, p_user_id uuid, p_actor_user_id uuid, p_actor_role text, p_reason text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid; v_banned_until timestamptz; v_existing public.platform_account_unlocks%rowtype;
begin
  perform public.assert_platform_account_admin(p_actor_user_id, p_actor_role);
  if p_request_id is null or char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_accounts_invalid_input' using errcode = '22023';
  end if;
  select owner_id into v_owner from public.restaurants where id = p_restaurant_id and deleted_at is null for update;
  if not found then raise exception 'platform_tenant_not_found' using errcode = 'P0002'; end if;
  if p_user_id is null or (v_owner <> p_user_id and not exists(
    select 1 from public.restaurant_members where restaurant_id = p_restaurant_id and user_id = p_user_id and accepted_at is not null
  )) then raise exception 'platform_account_scope_mismatch' using errcode = '42501'; end if;
  if exists(select 1 from public.platform_admin_users where user_id = p_user_id and status <> 'revoked') then
    raise exception 'platform_admin_account_protected' using errcode = '42501';
  end if;
  select banned_until into v_banned_until from auth.users where id = p_user_id and deleted_at is null for update;
  if not found then raise exception 'platform_account_not_found' using errcode = 'P0002'; end if;
  select * into v_existing from public.platform_account_unlocks where request_id = p_request_id;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.restaurant_id <> p_restaurant_id or v_existing.actor_user_id <> p_actor_user_id then
      raise exception 'platform_account_request_mismatch' using errcode = '42501';
    end if;
    return jsonb_build_object('requestId', p_request_id, 'status', v_existing.status, 'execute', false);
  end if;
  -- Unknown external outcomes are not blindly retried, even with a new request id.
  if exists(select 1 from public.platform_account_unlocks where user_id = p_user_id and status = 'pending') then
    raise exception 'platform_account_unban_pending' using errcode = '55000';
  end if;
  insert into public.platform_account_unlocks(request_id, restaurant_id, user_id, actor_user_id, reason, status, previous_banned_until, completed_at)
  values(p_request_id, p_restaurant_id, p_user_id, p_actor_user_id, btrim(p_reason),
    case when v_banned_until > now() then 'pending' else 'completed' end,
    v_banned_until, case when v_banned_until > now() then null else now() end);
  insert into public.platform_admin_audit_log(actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values(p_actor_user_id, p_actor_role, 'tenant.account.unban_requested', 'auth_user', p_user_id::text, btrim(p_reason), p_request_id,
    jsonb_build_object('restaurantId', p_restaurant_id, 'bannedUntil', v_banned_until),
    jsonb_build_object('status', case when v_banned_until > now() then 'pending' else 'completed' end, 'scope', 'global_auth'));
  return jsonb_build_object('requestId', p_request_id, 'status', case when v_banned_until > now() then 'pending' else 'completed' end,
    'execute', coalesce(v_banned_until > now(), false));
end;
$$;

create function public.finish_platform_admin_user_unban(
  p_restaurant_id uuid, p_actor_user_id uuid, p_actor_role text, p_request_id uuid, p_rejected boolean default false
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_operation public.platform_account_unlocks%rowtype; v_banned_until timestamptz; v_status text;
begin
  perform public.assert_platform_account_admin(p_actor_user_id, p_actor_role);
  select * into v_operation from public.platform_account_unlocks
  where request_id = p_request_id and restaurant_id = p_restaurant_id for update;
  if not found then raise exception 'platform_account_request_not_found' using errcode = 'P0002'; end if;
  if v_operation.status <> 'pending' then return jsonb_build_object('requestId', p_request_id, 'status', v_operation.status); end if;
  -- Observe Auth's persisted result rather than trusting an HTTP success or client-supplied status.
  select banned_until into v_banned_until from auth.users where id = v_operation.user_id and deleted_at is null;
  if not found then v_status := 'failed';
  elsif v_banned_until is null or v_banned_until <= now() then v_status := 'completed';
  elsif p_rejected then v_status := 'failed';
  else return jsonb_build_object('requestId', p_request_id, 'status', 'pending'); end if;
  update public.platform_account_unlocks set status = v_status, completed_at = now() where request_id = p_request_id;
  insert into public.platform_admin_audit_log(actor_user_id, actor_role, action, target_type, target_id, reason, request_id, before_state, after_state)
  values(p_actor_user_id, p_actor_role, 'tenant.account.unban_resolved', 'auth_user', v_operation.user_id::text,
    v_operation.reason, p_request_id, jsonb_build_object('status', 'pending', 'bannedUntil', v_operation.previous_banned_until),
    jsonb_build_object('restaurantId', p_restaurant_id, 'status', v_status, 'bannedUntil', v_banned_until));
  return jsonb_build_object('requestId', p_request_id, 'status', v_status);
end;
$$;

revoke all on function public.assert_platform_account_admin(uuid,text) from public, anon, authenticated;
revoke all on function public.reveal_platform_admin_tenant_accounts(uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.reactivate_platform_admin_tenant_member(uuid,uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.prepare_platform_admin_user_unban(uuid,uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.finish_platform_admin_user_unban(uuid,uuid,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.reveal_platform_admin_tenant_accounts(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.reactivate_platform_admin_tenant_member(uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.prepare_platform_admin_user_unban(uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.finish_platform_admin_user_unban(uuid,uuid,text,uuid,boolean) to service_role;
