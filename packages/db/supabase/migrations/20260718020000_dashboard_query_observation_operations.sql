-- Operational health rollup and bounded retention for dashboard query telemetry.
-- Raw observations stay service-role only; the health RPC deliberately returns
-- aggregate counts without restaurant identifiers or query error text.

create or replace function public.get_dashboard_query_observation_health(
  p_since timestamptz default (now() - interval '15 minutes')
)
returns table (
  operation text,
  observation_count bigint,
  slow_success_count bigint,
  degraded_count bigint,
  failure_count bigint,
  issue_count bigint,
  affected_restaurant_count bigint,
  p95_duration_ms integer,
  oldest_observation_at timestamptz,
  latest_observation_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounded_window as (
    select greatest(
      coalesce(p_since, now() - interval '15 minutes'),
      now() - interval '7 days'
    ) as started_at
  )
  select
    observation.operation,
    count(*) as observation_count,
    count(*) filter (where observation.outcome = 'success') as slow_success_count,
    count(*) filter (where observation.outcome = 'degraded') as degraded_count,
    count(*) filter (where observation.outcome = 'failure') as failure_count,
    coalesce(sum(observation.issue_count), 0)::bigint as issue_count,
    count(distinct observation.restaurant_id) as affected_restaurant_count,
    round(percentile_cont(0.95) within group (order by observation.duration_ms))::integer
      as p95_duration_ms,
    min(observation.created_at) as oldest_observation_at,
    max(observation.created_at) as latest_observation_at
  from public.dashboard_query_observations observation
  cross join bounded_window
  where observation.created_at >= bounded_window.started_at
  group by observation.operation
  order by observation.operation;
$$;

create or replace function public.prune_dashboard_query_observations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.dashboard_query_observations
  where created_at < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.get_dashboard_query_observation_health(timestamptz)
  from public, anon, authenticated;
revoke all on function public.prune_dashboard_query_observations()
  from public, anon, authenticated;

grant execute on function public.get_dashboard_query_observation_health(timestamptz)
  to service_role;
grant execute on function public.prune_dashboard_query_observations()
  to service_role;

-- pg_cron is already part of the platform operations stack. Reinstalling the
-- named job makes migration replay and environment promotion deterministic.
create extension if not exists pg_cron;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'dashboard-query-observation-retention-daily';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'dashboard-query-observation-retention-daily',
    '17 3 * * *',
    'select public.prune_dashboard_query_observations();'
  );
end;
$$;
