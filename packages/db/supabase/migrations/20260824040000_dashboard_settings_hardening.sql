-- Narrow, additive foundations for Dashboard Settings hardening. No secret or
-- export document is stored in these relations.

create table if not exists public.restaurant_settings_revisions (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  source text not null default 'settings' check (source in ('settings', 'timezone')),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.restaurant_settings_revisions enable row level security;
alter table public.restaurant_settings_revisions force row level security;
alter table public.restaurant_settings_revisions replica identity full;
revoke all on public.restaurant_settings_revisions from public, anon, authenticated;
grant select (restaurant_id, revision, source, updated_at)
  on public.restaurant_settings_revisions to authenticated;

drop policy if exists restaurant_settings_revisions_read on public.restaurant_settings_revisions;
create policy restaurant_settings_revisions_read on public.restaurant_settings_revisions
  for select to authenticated
  using (public.has_restaurant_section(restaurant_id, 'settings'));

create or replace function public.bump_restaurant_settings_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source text;
begin
  if new.settings is not distinct from old.settings
    and new.timezone is not distinct from old.timezone then
    return null;
  end if;
  v_source := case when new.timezone is distinct from old.timezone then 'timezone' else 'settings' end;
  insert into public.restaurant_settings_revisions (restaurant_id, revision, source, updated_at)
  values (new.id, 1, v_source, clock_timestamp())
  on conflict (restaurant_id) do update
    set revision = public.restaurant_settings_revisions.revision + 1,
        source = excluded.source,
        updated_at = excluded.updated_at;
  return null;
end;
$$;

revoke all on function public.bump_restaurant_settings_revision() from public, anon, authenticated;
drop trigger if exists restaurant_settings_revision_after_update on public.restaurants;
create trigger restaurant_settings_revision_after_update
  after update of settings, timezone on public.restaurants
  for each row execute function public.bump_restaurant_settings_revision();

create table if not exists public.restaurant_timezone_requests (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  request_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  requested_timezone text not null,
  expected_timezone text not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (restaurant_id, request_id)
);
alter table public.restaurant_timezone_requests enable row level security;
alter table public.restaurant_timezone_requests force row level security;
revoke all on public.restaurant_timezone_requests from public, anon, authenticated;
grant select, insert on public.restaurant_timezone_requests to service_role;

create or replace function public.update_restaurant_timezone_cas(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_timezone text,
  p_expected_timezone text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.restaurant_timezone_requests%rowtype;
  v_current_timezone text;
  v_result jsonb;
begin
  if p_restaurant_id is null or p_actor_user_id is null or p_request_id is null
    or length(p_timezone) not between 1 and 100
    or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'timezone_request_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then raise exception 'timezone_request_access_denied' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || ':' || p_request_id::text, 0));
  select * into v_existing from public.restaurant_timezone_requests
    where restaurant_id = p_restaurant_id and request_id = p_request_id;
  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.requested_timezone <> p_timezone
      or v_existing.expected_timezone <> p_expected_timezone then
      raise exception 'timezone_request_conflict' using errcode = '23505';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select timezone into v_current_timezone from public.restaurants
    where id = p_restaurant_id for update;
  if v_current_timezone = p_timezone then
    v_result := jsonb_build_object('outcome', 'applied', 'timezone', p_timezone, 'idempotent', true);
  elsif v_current_timezone is distinct from p_expected_timezone then
    v_result := jsonb_build_object('outcome', 'conflict', 'timezone', v_current_timezone, 'idempotent', false);
  else
    update public.restaurants set timezone = p_timezone where id = p_restaurant_id;
    v_result := jsonb_build_object('outcome', 'applied', 'timezone', p_timezone, 'idempotent', false);
  end if;

  insert into public.restaurant_timezone_requests (
    restaurant_id, request_id, actor_user_id, requested_timezone, expected_timezone, result
  ) values (
    p_restaurant_id, p_request_id, p_actor_user_id, p_timezone, p_expected_timezone, v_result
  );
  return v_result;
end;
$$;
revoke all on function public.update_restaurant_timezone_cas(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.update_restaurant_timezone_cas(uuid,uuid,text,text,uuid) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_settings_revisions'
  ) then
    alter publication supabase_realtime add table public.restaurant_settings_revisions;
  end if;
end;
$$;

alter table public.restaurant_members replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurant_members'
  ) then
    alter publication supabase_realtime add table public.restaurant_members;
  end if;
end;
$$;

create table if not exists public.restaurant_integration_health (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null check (provider in ('iyzico', 'resend')),
  mode text not null check (mode in ('platform', 'sandbox', 'live')),
  status text not null check (status in ('unconfigured', 'untested', 'healthy', 'error')),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  error_code text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (restaurant_id, provider),
  check (error_code is null or length(error_code) <= 80)
);
alter table public.restaurant_integration_health enable row level security;
alter table public.restaurant_integration_health force row level security;
revoke all on public.restaurant_integration_health from public, anon, authenticated;
grant select, insert, update, delete on public.restaurant_integration_health to service_role;

create table if not exists public.tenant_privacy_operations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  operation_type text not null check (operation_type in ('export', 'account_deletion_request', 'restaurant_deletion_request')),
  status text not null default 'requested' check (status in ('requested', 'processing', 'ready', 'completed', 'rejected')),
  reason text not null check (length(trim(reason)) between 3 and 500),
  result_digest text,
  result_summary jsonb,
  request_id uuid not null unique,
  requested_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (result_digest is null or result_digest ~ '^[0-9a-f]{64}$')
);
create index if not exists tenant_privacy_operations_restaurant_idx
  on public.tenant_privacy_operations (restaurant_id, requested_at desc);
alter table public.tenant_privacy_operations enable row level security;
alter table public.tenant_privacy_operations force row level security;
revoke all on public.tenant_privacy_operations from public, anon, authenticated;
grant select, insert, update on public.tenant_privacy_operations to service_role;

create or replace function public.request_tenant_privacy_operation(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_operation_type text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.tenant_privacy_operations%rowtype;
  v_created public.tenant_privacy_operations%rowtype;
begin
  if p_operation_type not in ('export', 'account_deletion_request', 'restaurant_deletion_request')
    or length(trim(p_reason)) not between 3 and 500 then
    raise exception 'privacy_request_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then
    raise exception 'privacy_request_access_denied' using errcode = '42501';
  end if;
  select * into v_existing from public.tenant_privacy_operations where request_id = p_request_id;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id
      or v_existing.requested_by <> p_actor_user_id
      or v_existing.operation_type <> p_operation_type
      or v_existing.reason <> trim(p_reason) then
      raise exception 'privacy_request_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'duplicate', true);
  end if;
  insert into public.tenant_privacy_operations (
    restaurant_id, requested_by, operation_type, reason, request_id
  ) values (
    p_restaurant_id, p_actor_user_id, p_operation_type, trim(p_reason), p_request_id
  ) returning * into v_created;
  return jsonb_build_object('id', v_created.id, 'status', v_created.status, 'duplicate', false);
end;
$$;
revoke all on function public.request_tenant_privacy_operation(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.request_tenant_privacy_operation(uuid,uuid,text,text,uuid) to service_role;

create or replace function public.export_owner_tenant_privacy_data(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_existing public.tenant_privacy_operations%rowtype;
  v_created public.tenant_privacy_operations%rowtype;
  v_document jsonb;
  v_summary jsonb;
  v_digest text;
begin
  if length(trim(coalesce(p_reason, ''))) not between 3 and 500 or p_request_id is null then
    raise exception 'privacy_request_invalid' using errcode = '22023';
  end if;
  select * into v_restaurant from public.restaurants
    where id = p_restaurant_id and owner_id = p_actor_user_id and deleted_at is null;
  if not found then raise exception 'privacy_request_access_denied' using errcode = '42501'; end if;

  with customer_ids as (
    select customer_id from public.customer_restaurants where restaurant_id = p_restaurant_id
    union select customer_id from public.orders where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.loyalty_transactions where restaurant_id = p_restaurant_id
    union select customer_id from public.customer_consents where restaurant_id = p_restaurant_id
    union select customer_id from public.payment_shares where restaurant_id = p_restaurant_id and customer_id is not null
    union select customer_id from public.campaign_recipients where restaurant_id = p_restaurant_id
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', clock_timestamp(),
    'tenant', jsonb_build_object(
      'id', v_restaurant.id, 'name', v_restaurant.name, 'slug', v_restaurant.slug,
      'timezone', v_restaurant.timezone, 'createdAt', v_restaurant.created_at
    ),
    'customers', coalesce(jsonb_agg(jsonb_build_object(
      'id', customer.id, 'name', customer.name, 'email', customer.email,
      'phone', customer.phone, 'verifiedAt', customer.verified_at,
      'consents', coalesce((select jsonb_agg(jsonb_build_object(
        'type', consent_type, 'grantedAt', granted_at, 'revokedAt', revoked_at, 'source', source
      ) order by created_at) from public.customer_consents where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'status', status, 'total', total, 'paymentMethod', payment_method, 'createdAt', created_at
      ) order by created_at) from public.orders where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'loyalty', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'type', type, 'delta', delta, 'reason', reason, 'direction', direction, 'createdAt', created_at
      ) order by created_at) from public.loyalty_transactions where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'paymentShares', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'amount', amount, 'method', method, 'status', status, 'createdAt', created_at
      ) order by created_at) from public.payment_shares where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb),
      'campaignRecipients', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'campaignId', campaign_id, 'phone', phone, 'status', status, 'sentAt', sent_at, 'createdAt', created_at
      ) order by created_at) from public.campaign_recipients where restaurant_id = p_restaurant_id and customer_id = customer.id), '[]'::jsonb)
    ) order by customer.created_at), '[]'::jsonb)
  ) into v_document
  from customer_ids ids join public.customers customer on customer.id = ids.customer_id;

  v_digest := encode(digest(convert_to(v_document::text, 'utf8'), 'sha256'), 'hex');
  v_summary := jsonb_build_object(
    'customerCount', jsonb_array_length(v_document->'customers'),
    'schemaVersion', 1
  );
  select * into v_existing from public.tenant_privacy_operations where request_id = p_request_id;
  if found then
    if v_existing.restaurant_id <> p_restaurant_id or v_existing.requested_by <> p_actor_user_id
      or v_existing.operation_type <> 'export' or v_existing.reason <> trim(p_reason)
      or v_existing.result_digest is distinct from v_digest then
      raise exception 'privacy_request_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
      'duplicate', true, 'digest', v_digest, 'document', v_document);
  end if;
  insert into public.tenant_privacy_operations (
    restaurant_id, requested_by, operation_type, status, reason, result_digest,
    result_summary, request_id
  ) values (
    p_restaurant_id, p_actor_user_id, 'export', 'completed', trim(p_reason),
    v_digest, v_summary, p_request_id
  ) returning * into v_created;
  return jsonb_build_object('id', v_created.id, 'status', v_created.status,
    'duplicate', false, 'digest', v_digest, 'document', v_document);
end;
$$;
revoke all on function public.export_owner_tenant_privacy_data(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.export_owner_tenant_privacy_data(uuid,uuid,text,uuid) to service_role;

create or replace function public.mutate_team_member_with_audit(
  p_restaurant_id uuid,
  p_actor_user_id uuid,
  p_member_id uuid,
  p_operation text,
  p_permissions jsonb default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.restaurant_members%rowtype;
  v_event_type text;
begin
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.owner_id = p_actor_user_id and r.deleted_at is null
  ) then raise exception 'team_mutation_access_denied' using errcode = '42501'; end if;

  select * into v_member from public.restaurant_members
    where id = p_member_id and restaurant_id = p_restaurant_id for update;
  if not found then raise exception 'team_member_not_found' using errcode = 'P0002'; end if;

  if p_operation = 'permissions' then
    if jsonb_typeof(p_permissions) <> 'array' or jsonb_array_length(p_permissions) < 1
      or exists (
        select 1 from jsonb_array_elements_text(p_permissions) permission
        where permission not in ('pano','orders','menu','tables','customers','analytics','theme','settings')
      ) then raise exception 'team_permissions_invalid' using errcode = '22023'; end if;
    update public.restaurant_members set permissions = p_permissions
      where id = p_member_id returning * into v_member;
    v_event_type := 'team_member_permissions_updated';
  elsif p_operation = 'status' then
    if p_status not in ('active', 'disabled') or v_member.status = 'invited' then
      raise exception 'team_status_invalid' using errcode = '22023';
    end if;
    update public.restaurant_members set status = p_status
      where id = p_member_id returning * into v_member;
    v_event_type := case when p_status = 'active' then 'team_member_activated' else 'team_member_disabled' end;
  elsif p_operation = 'remove' then
    delete from public.restaurant_members where id = p_member_id;
    v_event_type := 'team_member_removed';
  else
    raise exception 'team_operation_invalid' using errcode = '22023';
  end if;

  insert into public.security_events (user_id, restaurant_id, event_type, metadata)
  values (
    p_actor_user_id,
    p_restaurant_id,
    v_event_type,
    jsonb_build_object('targetEmail', v_member.email, 'permissions', v_member.permissions)
  );

  return jsonb_build_object(
    'email', v_member.email,
    'permissions', v_member.permissions,
    'status', v_member.status
  );
end;
$$;
revoke all on function public.mutate_team_member_with_audit(uuid,uuid,uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.mutate_team_member_with_audit(uuid,uuid,uuid,text,jsonb,text) to service_role;

create or replace function public.prune_dashboard_security_events()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_deleted integer;
begin
  delete from public.security_events
  where (event_type in ('login', 'password_change') and created_at < clock_timestamp() - interval '180 days')
     or (event_type like 'team_%' and created_at < clock_timestamp() - interval '365 days');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function public.prune_dashboard_security_events() from public, anon, authenticated;
grant execute on function public.prune_dashboard_security_events() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'prune-dashboard-security-events') then
      perform cron.schedule('prune-dashboard-security-events', '17 3 * * *', 'select public.prune_dashboard_security_events()');
    end if;
  end if;
end;
$$;

create table if not exists public.dashboard_auth_rate_limits (
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  action text not null check (length(action) between 3 and 64),
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0),
  primary key (subject_hash, action)
);
alter table public.dashboard_auth_rate_limits enable row level security;
alter table public.dashboard_auth_rate_limits force row level security;
revoke all on public.dashboard_auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.dashboard_auth_rate_limits to service_role;

create or replace function public.consume_dashboard_auth_rate_limit(
  p_subject_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.dashboard_auth_rate_limits%rowtype;
begin
  if p_subject_hash !~ '^[0-9a-f]{64}$' or p_limit < 1 or p_window_seconds not between 10 and 86400 then
    raise exception 'dashboard_rate_limit_invalid' using errcode = '22023';
  end if;
  insert into public.dashboard_auth_rate_limits (subject_hash, action, window_started_at, attempts)
  values (p_subject_hash, p_action, clock_timestamp(), 1)
  on conflict (subject_hash, action) do update set
    window_started_at = case
      when public.dashboard_auth_rate_limits.window_started_at <= clock_timestamp() - make_interval(secs => p_window_seconds)
        then clock_timestamp()
      else public.dashboard_auth_rate_limits.window_started_at
    end,
    attempts = case
      when public.dashboard_auth_rate_limits.window_started_at <= clock_timestamp() - make_interval(secs => p_window_seconds)
        then 1
      else public.dashboard_auth_rate_limits.attempts + 1
    end
  returning * into v_row;
  return v_row.attempts <= p_limit;
end;
$$;
revoke all on function public.consume_dashboard_auth_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_dashboard_auth_rate_limit(text,text,integer,integer) to service_role;

comment on table public.tenant_privacy_operations is
  'Owner-requested privacy operations; exported documents are never persisted.';
comment on table public.restaurant_integration_health is
  'Secret-free provider health metadata exposed only through owner-gated read models.';
