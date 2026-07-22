-- Faz 6.1: isolated platform-admin identities and append-only audit trail.
-- Restaurant ownership/membership never grants this access implicitly.

create table public.platform_admin_users (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('support', 'ops', 'finance', 'superadmin')),
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'revoked')),
  display_name text check (display_name is null or char_length(display_name) <= 120),
  invited_by uuid references auth.users(id) on delete restrict,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and activated_at is not null) or status <> 'active')
);

create index platform_admin_users_status_role_idx
  on public.platform_admin_users (status, role);

alter table public.platform_admin_users enable row level security;
revoke all on table public.platform_admin_users from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_admin_users to service_role;

create table public.platform_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.platform_admin_users(user_id) on delete restrict,
  actor_role text not null check (actor_role in ('support', 'ops', 'finance', 'superadmin')),
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{2,119}$'),
  target_type text not null check (target_type ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  target_id text check (target_id is null or char_length(target_id) <= 200),
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  request_id uuid not null,
  before_state jsonb check (
    before_state is null or (
      jsonb_typeof(before_state) = 'object'
      and octet_length(before_state::text) <= 65536
    )
  ),
  after_state jsonb check (
    after_state is null or (
      jsonb_typeof(after_state) = 'object'
      and octet_length(after_state::text) <= 65536
    )
  ),
  created_at timestamptz not null default now()
);

create unique index platform_admin_audit_idempotency_idx
  on public.platform_admin_audit_log (
    actor_user_id,
    request_id,
    action,
    target_type,
    coalesce(target_id, '')
  );
create index platform_admin_audit_target_idx
  on public.platform_admin_audit_log (target_type, target_id, created_at desc);

alter table public.platform_admin_audit_log enable row level security;
revoke all on table public.platform_admin_audit_log from public, anon, authenticated;
grant select, insert on table public.platform_admin_audit_log to service_role;

create or replace function public.reject_platform_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'platform_admin_audit_is_append_only' using errcode = '55000';
end;
$$;

create trigger platform_admin_audit_append_only
before update or delete on public.platform_admin_audit_log
for each row execute function public.reject_platform_admin_audit_mutation();

create or replace function public.read_platform_admin_identity(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when identity.user_id is null then null
    else jsonb_build_object(
      'userId', identity.user_id,
      'role', identity.role,
      'status', identity.status,
      'displayName', identity.display_name
    )
  end
  from (select p_user_id as requested_user_id) request
  left join public.platform_admin_users identity
    on identity.user_id = request.requested_user_id;
$$;

revoke all on function public.read_platform_admin_identity(uuid) from public, anon, authenticated;
grant execute on function public.read_platform_admin_identity(uuid) to service_role;

comment on table public.platform_admin_users is
  'Explicit platform control-plane identities; never inferred from tenant roles.';
comment on table public.platform_admin_audit_log is
  'Append-only reasoned audit records for platform-admin mutations.';
