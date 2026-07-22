-- Faz 6.3: platform-admin tenant service controls.
-- Operational access is separate from billing state so payment callbacks can
-- never clear a manual safety hold. Missing rows are backward-compatible active.

create table public.tenant_service_controls (
  restaurant_id uuid primary key references public.restaurants(id) on delete restrict,
  status text not null check (status in ('active', 'suspended', 'manual_hold')),
  version bigint not null default 1 check (version > 0),
  changed_by uuid not null references public.platform_admin_users(user_id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenant_service_controls_status_idx
  on public.tenant_service_controls(status, updated_at desc);

create trigger tenant_service_controls_updated_at
  before update on public.tenant_service_controls
  for each row execute function public.update_updated_at();

alter table public.tenant_service_controls enable row level security;
revoke all on table public.tenant_service_controls from public, anon, authenticated;
grant select, insert, update on table public.tenant_service_controls to service_role;

create or replace function public.read_platform_admin_tenant_service_control(
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_control public.tenant_service_controls%rowtype;
begin
  if not exists (
    select 1 from public.restaurants
    where id = p_restaurant_id and deleted_at is null
  ) then
    return null;
  end if;

  select * into v_control
  from public.tenant_service_controls
  where restaurant_id = p_restaurant_id;

  return jsonb_build_object(
    'restaurantId', p_restaurant_id,
    'status', coalesce(v_control.status, 'active'),
    'version', coalesce(v_control.version, 0),
    'updatedAt', v_control.updated_at
  );
end;
$$;

create or replace function public.set_platform_admin_tenant_service_status(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_status text,
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
  v_restaurant public.restaurants%rowtype;
  v_control public.tenant_service_controls%rowtype;
  v_previous_status text;
  v_action text;
  v_after jsonb;
  v_existing_after jsonb;
  v_changed boolean;
begin
  if p_status not in ('active', 'suspended', 'manual_hold') then
    raise exception 'platform_tenant_service_status_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'platform_tenant_service_reason_invalid' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'platform_tenant_service_request_invalid' using errcode = '22023';
  end if;

  select * into v_identity
  from public.platform_admin_users
  where user_id = p_actor_user_id
  for update;
  if not found
    or v_identity.status <> 'active'
    or v_identity.role <> p_actor_role
    or v_identity.role not in ('ops', 'superadmin') then
    raise exception 'platform_tenant_service_not_authorized' using errcode = '42501';
  end if;

  v_action := case p_status
    when 'active' then 'tenant.service.reactivate'
    when 'suspended' then 'tenant.service.suspend'
    else 'tenant.service.manual_hold'
  end;

  select after_state into v_existing_after
  from public.platform_admin_audit_log
  where actor_user_id = p_actor_user_id
    and request_id = p_request_id
    and action = v_action
    and target_type = 'restaurant'
    and target_id = p_restaurant_id::text;
  if found then
    return v_existing_after || jsonb_build_object('duplicate', true);
  end if;

  select * into v_restaurant
  from public.restaurants
  where id = p_restaurant_id and deleted_at is null
  for update;
  if not found then
    raise exception 'platform_tenant_not_found' using errcode = 'P0002';
  end if;

  select * into v_control
  from public.tenant_service_controls
  where restaurant_id = p_restaurant_id
  for update;
  v_previous_status := coalesce(v_control.status, 'active');
  v_changed := v_previous_status <> p_status;

  if v_control.restaurant_id is null then
    insert into public.tenant_service_controls (
      restaurant_id, status, version, changed_by, reason
    ) values (
      p_restaurant_id, p_status, 1, p_actor_user_id, btrim(p_reason)
    ) returning * into v_control;
  elsif v_changed then
    update public.tenant_service_controls
    set status = p_status,
        version = version + 1,
        changed_by = p_actor_user_id,
        reason = btrim(p_reason)
    where restaurant_id = p_restaurant_id
    returning * into v_control;
  end if;

  v_after := jsonb_build_object(
    'restaurantId', p_restaurant_id,
    'previousStatus', v_previous_status,
    'status', p_status,
    'version', coalesce(v_control.version, 0),
    'updatedAt', coalesce(v_control.updated_at, now()),
    'changed', v_changed,
    'requestId', p_request_id,
    'duplicate', false
  );

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, target_type, target_id,
    reason, request_id, before_state, after_state
  ) values (
    p_actor_user_id, v_identity.role, v_action, 'restaurant', p_restaurant_id::text,
    btrim(p_reason), p_request_id,
    jsonb_build_object('serviceStatus', v_previous_status), v_after
  );

  return v_after;
end;
$$;

revoke all on function public.read_platform_admin_tenant_service_control(uuid)
  from public, anon, authenticated;
revoke all on function public.set_platform_admin_tenant_service_status(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.read_platform_admin_tenant_service_control(uuid)
  to service_role;
grant execute on function public.set_platform_admin_tenant_service_status(uuid,uuid,text,text,text,uuid)
  to service_role;

comment on table public.tenant_service_controls is
  'Platform operational access state; missing row means active. Separate from provider-driven billing status.';
comment on function public.set_platform_admin_tenant_service_status(uuid,uuid,text,text,text,uuid) is
  'Atomically verifies platform role, changes tenant service access and appends a reasoned idempotent audit record.';
