-- Faz 6.6: time-bounded, audited tenant feature overrides.
-- The canonical plan stays untouched. Effective access is resolved at runtime
-- from this service-role-only projection and automatically falls back to the
-- plan after expiry or explicit revocation.

create table public.tenant_feature_overrides (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  feature text not null check (feature in (
    'browser_notifications', 'kitchen_display', 'loyalty',
    'analytics_advanced', 'theme_advanced_sections'
  )),
  decision text not null check (decision in ('allow', 'deny')),
  expires_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  updated_by uuid not null references public.platform_admin_users(user_id) on delete restrict,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, feature),
  check (expires_at > updated_at and expires_at <= updated_at + interval '30 days 5 minutes')
);

create index tenant_feature_overrides_active_idx
  on public.tenant_feature_overrides (restaurant_id, expires_at desc);

alter table public.tenant_feature_overrides enable row level security;
revoke all on table public.tenant_feature_overrides from public, anon, authenticated;
grant select, insert, update, delete on table public.tenant_feature_overrides to service_role;

create or replace function public.read_active_tenant_feature_override(
  p_restaurant_id uuid,
  p_feature text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when feature is null then null else jsonb_build_object(
    'feature', feature,
    'decision', decision,
    'expiresAt', expires_at
  ) end
  from (select p_restaurant_id as restaurant_id, p_feature as requested_feature) request
  left join public.tenant_feature_overrides feature_override
    on feature_override.restaurant_id = request.restaurant_id
   and feature_override.feature = request.requested_feature
   and feature_override.expires_at > now();
$$;

revoke all on function public.read_active_tenant_feature_override(uuid,text)
  from public, anon, authenticated;
grant execute on function public.read_active_tenant_feature_override(uuid,text)
  to service_role;

create or replace function public.read_platform_admin_tenant_feature_overrides(
  p_restaurant_id uuid,
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
begin
  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role then
    raise exception 'platform_entitlement_read_not_authorized' using errcode = '42501';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id and deleted_at is null;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'restaurantId', feature_override.restaurant_id,
      'feature', feature_override.feature,
      'decision', feature_override.decision,
      'expiresAt', feature_override.expires_at,
      'reason', feature_override.reason,
      'updatedAt', feature_override.updated_at,
      'updatedBy', feature_override.updated_by
    ) order by feature_override.expires_at desc, feature_override.feature)
    from public.tenant_feature_overrides feature_override
    where feature_override.restaurant_id = p_restaurant_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.read_platform_admin_tenant_feature_overrides(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.read_platform_admin_tenant_feature_overrides(uuid,uuid,text)
  to service_role;

create or replace function public.change_platform_admin_tenant_feature_override(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_action text,
  p_feature text,
  p_decision text,
  p_duration_days integer,
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
  v_before public.tenant_feature_overrides%rowtype;
  v_after public.tenant_feature_overrides%rowtype;
  v_before_json jsonb;
  v_after_json jsonb;
  v_response jsonb;
  v_existing_response jsonb;
  v_target_id text;
begin
  if coalesce(p_action, '') not in ('set', 'revoke') then
    raise exception 'platform_entitlement_action_invalid' using errcode = '22023';
  end if;
  if coalesce(p_feature, '') not in (
    'browser_notifications', 'kitchen_display', 'loyalty',
    'analytics_advanced', 'theme_advanced_sections'
  ) then
    raise exception 'platform_entitlement_feature_invalid' using errcode = '22023';
  end if;
  if p_action = 'set' and coalesce(p_decision, '') not in ('allow', 'deny') then
    raise exception 'platform_entitlement_decision_invalid' using errcode = '22023';
  end if;
  if p_action = 'set' and (p_duration_days is null or p_duration_days not between 1 and 30) then
    raise exception 'platform_entitlement_duration_invalid' using errcode = '22023';
  end if;
  if p_action = 'revoke' and (p_decision is not null or p_duration_days is not null) then
    raise exception 'platform_entitlement_revoke_payload_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_entitlement_reason_invalid' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'platform_entitlement_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id
  for update;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role not in ('ops', 'superadmin') then
    raise exception 'platform_entitlement_not_authorized' using errcode = '42501';
  end if;

  v_target_id := p_restaurant_id::text || ':' || p_feature;
  select after_state into v_existing_response
  from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id
    and request_id = p_request_id
    and action = 'tenant.entitlement_override.change'
    and target_type = 'restaurant_feature'
    and target_id = v_target_id;
  if found then
    return v_existing_response || jsonb_build_object('duplicate', true);
  end if;

  perform 1 from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  select * into v_before
  from public.tenant_feature_overrides
  where restaurant_id = p_restaurant_id and feature = p_feature
  for update;

  if v_before.restaurant_id is not null then
    v_before_json := jsonb_build_object(
      'restaurantId', v_before.restaurant_id,
      'feature', v_before.feature,
      'decision', v_before.decision,
      'expiresAt', v_before.expires_at,
      'reason', v_before.reason,
      'updatedAt', v_before.updated_at,
      'updatedBy', v_before.updated_by
    );
  end if;

  if p_action = 'set' then
    insert into public.tenant_feature_overrides (
      restaurant_id, feature, decision, expires_at, reason, updated_by,
      request_id, created_at, updated_at
    ) values (
      p_restaurant_id, p_feature, p_decision,
      now() + make_interval(days => p_duration_days), btrim(p_reason),
      p_actor_user_id, p_request_id, now(), now()
    )
    on conflict (restaurant_id, feature) do update set
      decision = excluded.decision,
      expires_at = excluded.expires_at,
      reason = excluded.reason,
      updated_by = excluded.updated_by,
      request_id = excluded.request_id,
      updated_at = now()
    returning * into v_after;

    v_after_json := jsonb_build_object(
      'restaurantId', v_after.restaurant_id,
      'feature', v_after.feature,
      'decision', v_after.decision,
      'expiresAt', v_after.expires_at,
      'reason', v_after.reason,
      'updatedAt', v_after.updated_at,
      'updatedBy', v_after.updated_by
    );
  else
    delete from public.tenant_feature_overrides
    where restaurant_id = p_restaurant_id and feature = p_feature;
    v_after_json := null;
  end if;

  v_response := jsonb_build_object(
    'restaurantId', p_restaurant_id,
    'feature', p_feature,
    'action', p_action,
    'before', v_before_json,
    'after', v_after_json,
    'duplicate', false,
    'requestId', p_request_id
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_actor_user_id, v_identity.role, 'tenant.entitlement_override.change',
    'restaurant_feature', v_target_id, btrim(p_reason), p_request_id,
    v_before_json, v_response
  );

  return v_response;
end;
$$;

revoke all on function public.change_platform_admin_tenant_feature_override(uuid,uuid,text,text,text,text,integer,text,uuid)
  from public, anon, authenticated;
grant execute on function public.change_platform_admin_tenant_feature_override(uuid,uuid,text,text,text,text,integer,text,uuid)
  to service_role;

comment on table public.tenant_feature_overrides is
  'Service-role-only effective feature projection; always time-bounded and backed by append-only platform audit.';
comment on function public.read_active_tenant_feature_override(uuid,text) is
  'Server runtime resolver for one currently active tenant feature override.';
comment on function public.change_platform_admin_tenant_feature_override(uuid,uuid,text,text,text,text,integer,text,uuid) is
  'Ops/superadmin-only replay-safe set/revoke command; never mutates plan or billing authority.';
