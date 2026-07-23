-- Platform Admin Phase 6.8: privacy-safe global error fingerprints.
--
-- This table deliberately excludes stack traces, SQL/provider messages,
-- request payloads and user identity. Infrastructure records only closed
-- machine labels and public Masabu error codes.

create table public.platform_error_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  app text not null check (app in ('dashboard', 'menu', 'kitchen', 'platform-admin', 'worker')),
  source text not null check (
    char_length(source) between 3 and 80
    and source ~ '^[a-z][a-z0-9.-]+$'
  ),
  public_code text not null check (public_code in (
    'MAS-VAL-001',
    'MAS-AUTH-001',
    'MAS-AUTH-002',
    'MAS-PLAN-403',
    'MAS-RES-404',
    'MAS-CMD-409',
    'MAS-ORD-409',
    'MAS-PAY-409',
    'MAS-RATE-429',
    'MAS-SVC-503',
    'MAS-UI-500'
  )),
  severity text not null check (severity in ('warning', 'error', 'critical')),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{32}$'),
  reference_id text check (
    reference_id is null
    or (
      char_length(reference_id) between 8 and 64
      and reference_id ~ '^[A-Za-z0-9-]+$'
    )
  ),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index platform_error_events_fingerprint_occurred_idx
  on public.platform_error_events (fingerprint, occurred_at desc);
create index platform_error_events_restaurant_occurred_idx
  on public.platform_error_events (restaurant_id, occurred_at desc)
  where restaurant_id is not null;
create index platform_error_events_severity_occurred_idx
  on public.platform_error_events (severity, occurred_at desc);

alter table public.platform_error_events enable row level security;
revoke all on table public.platform_error_events from public, anon, authenticated;
grant select, insert, delete on table public.platform_error_events to service_role;
grant usage, select on sequence public.platform_error_events_id_seq to service_role;

create or replace function public.record_platform_error_event(
  p_restaurant_id uuid,
  p_app text,
  p_source text,
  p_public_code text,
  p_severity text,
  p_reference_id text default null,
  p_occurred_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_source text := lower(btrim(coalesce(p_source, '')));
  v_reference_id text := nullif(btrim(coalesce(p_reference_id, '')), '');
  v_fingerprint text;
begin
  if p_app not in ('dashboard', 'menu', 'kitchen', 'platform-admin', 'worker')
    or char_length(v_source) not between 3 and 80
    or v_source !~ '^[a-z][a-z0-9.-]+$'
    or p_public_code not in (
      'MAS-VAL-001', 'MAS-AUTH-001', 'MAS-AUTH-002', 'MAS-PLAN-403',
      'MAS-RES-404', 'MAS-CMD-409', 'MAS-ORD-409', 'MAS-PAY-409',
      'MAS-RATE-429', 'MAS-SVC-503', 'MAS-UI-500'
    )
    or p_severity not in ('warning', 'error', 'critical')
    or (
      v_reference_id is not null
      and (
        char_length(v_reference_id) not between 8 and 64
        or v_reference_id !~ '^[A-Za-z0-9-]+$'
      )
    )
    or p_occurred_at < now() - interval '30 days'
    or p_occurred_at > now() + interval '5 minutes'
  then
    raise exception 'invalid platform error event input' using errcode = '22023';
  end if;

  v_fingerprint := md5(concat_ws('|', 'v1', p_app, v_source, p_public_code));

  insert into public.platform_error_events (
    restaurant_id,
    app,
    source,
    public_code,
    severity,
    fingerprint,
    reference_id,
    occurred_at
  ) values (
    p_restaurant_id,
    p_app,
    v_source,
    p_public_code,
    p_severity,
    v_fingerprint,
    v_reference_id,
    p_occurred_at
  );

  return v_fingerprint;
end;
$$;

create or replace function public.read_platform_admin_error_overview(
  p_window text default '24h',
  p_app text default null,
  p_severity text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_since timestamptz;
  v_event_count bigint;
  v_fingerprint_count bigint;
  v_critical_fingerprint_count bigint;
  v_affected_tenant_count bigint;
  v_items jsonb;
begin
  if p_window not in ('1h', '24h', '7d', '30d')
    or (p_app is not null and p_app not in ('dashboard', 'menu', 'kitchen', 'platform-admin', 'worker'))
    or (p_severity is not null and p_severity not in ('warning', 'error', 'critical'))
    or p_limit not in (25, 50, 100)
  then
    raise exception 'invalid platform error overview input' using errcode = '22023';
  end if;

  v_since := case p_window
    when '1h' then now() - interval '1 hour'
    when '24h' then now() - interval '24 hours'
    when '7d' then now() - interval '7 days'
    else now() - interval '30 days'
  end;

  with filtered as (
    select *
    from public.platform_error_events event
    where event.occurred_at >= v_since
      and (p_app is null or event.app = p_app)
      and (p_severity is null or event.severity = p_severity)
  ),
  grouped as (
    select
      event.fingerprint,
      max(case event.severity when 'critical' then 3 when 'error' then 2 else 1 end) as severity_rank
    from filtered event
    group by event.fingerprint
  )
  select
    (select count(*) from filtered),
    count(*),
    count(*) filter (where grouped.severity_rank = 3),
    (select count(distinct restaurant_id) from filtered where restaurant_id is not null)
  into
    v_event_count,
    v_fingerprint_count,
    v_critical_fingerprint_count,
    v_affected_tenant_count
  from grouped;

  with filtered as (
    select *
    from public.platform_error_events event
    where event.occurred_at >= v_since
      and (p_app is null or event.app = p_app)
      and (p_severity is null or event.severity = p_severity)
  ),
  grouped as (
    select
      event.fingerprint,
      min(event.app) as app,
      min(event.source) as source,
      min(event.public_code) as public_code,
      max(case event.severity when 'critical' then 3 when 'error' then 2 else 1 end) as severity_rank,
      count(*) as occurrence_count,
      count(distinct event.restaurant_id) as affected_tenant_count,
      min(event.occurred_at) as first_seen_at,
      max(event.occurred_at) as last_seen_at,
      (array_agg(event.restaurant_id order by event.occurred_at desc)
        filter (where event.restaurant_id is not null))[1] as sample_restaurant_id
    from filtered event
    group by event.fingerprint
    order by
      severity_rank desc,
      occurrence_count desc,
      last_seen_at desc,
      event.fingerprint
    limit p_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'fingerprint', grouped.fingerprint,
      'app', grouped.app,
      'source', grouped.source,
      'publicCode', grouped.public_code,
      'severity', case grouped.severity_rank when 3 then 'critical' when 2 then 'error' else 'warning' end,
      'occurrenceCount', grouped.occurrence_count,
      'affectedTenantCount', grouped.affected_tenant_count,
      'firstSeenAt', grouped.first_seen_at,
      'lastSeenAt', grouped.last_seen_at,
      'sampleTenant', case
        when restaurant.id is null then null
        else jsonb_build_object('id', restaurant.id, 'name', restaurant.name)
      end
    ) order by
      grouped.severity_rank desc,
      grouped.occurrence_count desc,
      grouped.last_seen_at desc,
      grouped.fingerprint
  ), '[]'::jsonb)
  into v_items
  from grouped
  left join public.restaurants restaurant on restaurant.id = grouped.sample_restaurant_id;

  return jsonb_build_object(
    'eventCount', coalesce(v_event_count, 0),
    'fingerprintCount', coalesce(v_fingerprint_count, 0),
    'criticalFingerprintCount', coalesce(v_critical_fingerprint_count, 0),
    'affectedTenantCount', coalesce(v_affected_tenant_count, 0),
    'items', v_items
  );
end;
$$;

create or replace function public.prune_platform_error_events()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_deleted integer;
begin
  delete from public.platform_error_events
  where occurred_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.record_platform_error_event(uuid, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.read_platform_admin_error_overview(text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.prune_platform_error_events()
  from public, anon, authenticated;
grant execute on function public.record_platform_error_event(uuid, text, text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.read_platform_admin_error_overview(text, text, text, integer)
  to service_role;
grant execute on function public.prune_platform_error_events()
  to service_role;

create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'platform-error-event-retention-daily';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'platform-error-event-retention-daily',
    '31 3 * * *',
    'select public.prune_platform_error_events();'
  );
end;
$$;
