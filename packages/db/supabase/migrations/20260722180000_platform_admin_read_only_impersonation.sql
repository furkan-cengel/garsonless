-- Faz 6.7: bounded, reasoned, read-only platform support sessions.
-- This is intentionally a control-plane capability. It never creates a
-- restaurant owner/member row and therefore cannot inherit tenant writes.

create table public.platform_admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  actor_user_id uuid not null references public.platform_admin_users(user_id) on delete restrict,
  actor_role text not null check (actor_role in ('support', 'ops', 'superadmin')),
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  start_request_id uuid not null unique,
  end_request_id uuid unique,
  created_at timestamptz not null default now(),
  check (expires_at > started_at and expires_at <= started_at + interval '60 minutes 5 seconds'),
  check (ended_at is null or ended_at >= started_at)
);

create index platform_admin_impersonation_actor_idx
  on public.platform_admin_impersonation_sessions (actor_user_id, expires_at desc);
create index platform_admin_impersonation_tenant_idx
  on public.platform_admin_impersonation_sessions (restaurant_id, started_at desc);
create unique index platform_admin_impersonation_one_open_per_actor_idx
  on public.platform_admin_impersonation_sessions (actor_user_id)
  where ended_at is null;

alter table public.platform_admin_impersonation_sessions enable row level security;
revoke all on table public.platform_admin_impersonation_sessions from public, anon, authenticated;
grant select, insert, update on table public.platform_admin_impersonation_sessions to service_role;

create or replace function public.read_platform_admin_impersonation_session(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_session public.platform_admin_impersonation_sessions%rowtype;
  v_status text;
begin
  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role not in ('support', 'ops', 'superadmin') then
    raise exception 'platform_impersonation_read_not_authorized' using errcode = '42501';
  end if;

  select * into v_session
  from public.platform_admin_impersonation_sessions
  where id = p_session_id and actor_user_id = p_actor_user_id;
  if not found then return null; end if;

  v_status := case
    when v_session.expires_at <= now() then 'expired'
    when v_session.ended_at is not null then 'ended'
    else 'active'
  end;
  return jsonb_build_object(
    'id', v_session.id,
    'restaurantId', v_session.restaurant_id,
    'actorUserId', v_session.actor_user_id,
    'actorRole', v_session.actor_role,
    'reason', v_session.reason,
    'startedAt', v_session.started_at,
    'expiresAt', v_session.expires_at,
    'endedAt', v_session.ended_at,
    'status', v_status
  );
end;
$$;

revoke all on function public.read_platform_admin_impersonation_session(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.read_platform_admin_impersonation_session(uuid,uuid,text)
  to service_role;

create or replace function public.start_platform_admin_impersonation_session(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_duration_minutes integer,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_session public.platform_admin_impersonation_sessions%rowtype;
  v_session_json jsonb;
  v_response jsonb;
  v_replay jsonb;
begin
  if p_duration_minutes is null or p_duration_minutes not in (15, 30, 60) then
    raise exception 'platform_impersonation_duration_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_impersonation_reason_invalid' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'platform_impersonation_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id
  for update;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role not in ('support', 'ops', 'superadmin') then
    raise exception 'platform_impersonation_not_authorized' using errcode = '42501';
  end if;

  select after_state into v_replay
  from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id
    and request_id = p_request_id
    and action = 'tenant.impersonation.start'
    and target_type = 'restaurant'
    and target_id = p_restaurant_id::text;
  if found then return v_replay || jsonb_build_object('duplicate', true); end if;

  perform 1 from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  update public.platform_admin_impersonation_sessions
  set ended_at = expires_at
  where actor_user_id = p_actor_user_id
    and ended_at is null
    and expires_at <= now();

  if exists (
    select 1 from public.platform_admin_impersonation_sessions
    where actor_user_id = p_actor_user_id and ended_at is null
  ) then
    raise exception 'platform_impersonation_already_active' using errcode = '55000';
  end if;

  insert into public.platform_admin_impersonation_sessions (
    restaurant_id, actor_user_id, actor_role, reason, started_at, expires_at,
    start_request_id, created_at
  ) values (
    p_restaurant_id, p_actor_user_id, p_actor_role, btrim(p_reason), now(),
    now() + make_interval(mins => p_duration_minutes), p_request_id, now()
  ) returning * into v_session;

  v_session_json := jsonb_build_object(
    'id', v_session.id,
    'restaurantId', v_session.restaurant_id,
    'actorUserId', v_session.actor_user_id,
    'actorRole', v_session.actor_role,
    'reason', v_session.reason,
    'startedAt', v_session.started_at,
    'expiresAt', v_session.expires_at,
    'endedAt', null,
    'status', 'active'
  );
  v_response := jsonb_build_object(
    'session', v_session_json,
    'requestId', p_request_id,
    'duplicate', false
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id, reason,
    request_id, before_state, after_state
  ) values (
    p_actor_user_id, p_actor_role, 'tenant.impersonation.start', 'restaurant',
    p_restaurant_id::text, btrim(p_reason), p_request_id, null, v_response
  );
  return v_response;
end;
$$;

revoke all on function public.start_platform_admin_impersonation_session(uuid,uuid,text,integer,text,uuid)
  from public, anon, authenticated;
grant execute on function public.start_platform_admin_impersonation_session(uuid,uuid,text,integer,text,uuid)
  to service_role;

create or replace function public.end_platform_admin_impersonation_session(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.platform_admin_users%rowtype;
  v_before public.platform_admin_impersonation_sessions%rowtype;
  v_after public.platform_admin_impersonation_sessions%rowtype;
  v_before_json jsonb;
  v_after_json jsonb;
  v_response jsonb;
  v_replay jsonb;
  v_status text;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_impersonation_reason_invalid' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'platform_impersonation_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id
  for update;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role not in ('support', 'ops', 'superadmin') then
    raise exception 'platform_impersonation_not_authorized' using errcode = '42501';
  end if;

  select after_state into v_replay
  from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id
    and request_id = p_request_id
    and action = 'tenant.impersonation.end'
    and target_type = 'impersonation_session'
    and target_id = p_session_id::text;
  if found then return v_replay || jsonb_build_object('duplicate', true); end if;

  select * into v_before
  from public.platform_admin_impersonation_sessions
  where id = p_session_id and actor_user_id = p_actor_user_id
  for update;
  if not found then
    raise exception 'platform_impersonation_session_not_found' using errcode = 'P0002';
  end if;

  v_before_json := jsonb_build_object(
    'id', v_before.id,
    'restaurantId', v_before.restaurant_id,
    'actorUserId', v_before.actor_user_id,
    'actorRole', v_before.actor_role,
    'startedAt', v_before.started_at,
    'expiresAt', v_before.expires_at,
    'endedAt', v_before.ended_at,
    'status', case
      when v_before.expires_at <= now() then 'expired'
      when v_before.ended_at is not null then 'ended'
      else 'active'
    end
  );

  if v_before.ended_at is null then
    update public.platform_admin_impersonation_sessions
    set ended_at = now(), end_request_id = p_request_id
    where id = p_session_id
    returning * into v_after;
  else
    v_after := v_before;
  end if;
  v_status := case when v_after.expires_at <= now() then 'expired' else 'ended' end;
  v_after_json := jsonb_build_object(
    'id', v_after.id,
    'restaurantId', v_after.restaurant_id,
    'actorUserId', v_after.actor_user_id,
    'actorRole', v_after.actor_role,
    'reason', v_after.reason,
    'startedAt', v_after.started_at,
    'expiresAt', v_after.expires_at,
    'endedAt', v_after.ended_at,
    'status', v_status
  );
  v_response := jsonb_build_object(
    'session', v_after_json,
    'requestId', p_request_id,
    'duplicate', false
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id, reason,
    request_id, before_state, after_state
  ) values (
    p_actor_user_id, p_actor_role, 'tenant.impersonation.end',
    'impersonation_session', p_session_id::text, btrim(p_reason), p_request_id,
    v_before_json, v_response
  );
  return v_response;
end;
$$;

revoke all on function public.end_platform_admin_impersonation_session(uuid,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.end_platform_admin_impersonation_session(uuid,uuid,text,text,uuid)
  to service_role;

comment on table public.platform_admin_impersonation_sessions is
  'Time-bounded control-plane support views; never a tenant membership or write authority.';
