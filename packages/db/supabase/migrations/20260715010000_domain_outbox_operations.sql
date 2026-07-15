-- Operational hardening for the modular-monolith outbox. Events that keep
-- failing must stop hot-looping, remain observable, and be explicitly
-- replayable after the underlying issue is fixed.

alter table public.domain_outbox
  add column if not exists dead_lettered_at timestamptz;

drop index if exists public.domain_outbox_ready_idx;
create index domain_outbox_ready_idx
  on public.domain_outbox(available_at, occurred_at)
  where processed_at is null and dead_lettered_at is null;

create index if not exists domain_outbox_dead_letter_idx
  on public.domain_outbox(dead_lettered_at desc)
  where dead_lettered_at is not null;

create or replace function public.claim_domain_outbox(
  p_worker text,
  p_limit integer default 25,
  p_lease_seconds integer default 60
)
returns setof public.domain_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(nullif(btrim(p_worker), ''), '') = '' then
    raise exception 'worker is required' using errcode = '22023';
  end if;

  return query
  with candidate as (
    select id
    from public.domain_outbox
    where processed_at is null
      and dead_lettered_at is null
      and available_at <= now()
      and (locked_at is null or locked_at < now() - make_interval(secs => greatest(p_lease_seconds, 1)))
    order by occurred_at, id
    limit greatest(least(p_limit, 100), 1)
    for update skip locked
  )
  update public.domain_outbox event
  set locked_at = now(),
      locked_by = p_worker,
      attempts = event.attempts + 1
  from candidate
  where event.id = candidate.id
  returning event.*;
end;
$$;

drop function if exists public.fail_domain_outbox(uuid, text, text, integer);
create function public.fail_domain_outbox(
  p_event_id uuid,
  p_worker text,
  p_error text,
  p_delay_seconds integer default 30
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts integer;
begin
  select attempts into v_attempts
  from public.domain_outbox
  where id = p_event_id
    and processed_at is null
    and dead_lettered_at is null
    and locked_by = p_worker
  for update;

  if not found then return 'lease_lost'; end if;

  update public.domain_outbox
  set locked_at = null,
      locked_by = null,
      available_at = case
        when v_attempts >= 8 then available_at
        else now() + make_interval(secs => greatest(1, least(p_delay_seconds, 86400)))
      end,
      dead_lettered_at = case when v_attempts >= 8 then now() else null end,
      last_error = left(coalesce(p_error, 'unknown error'), 1000)
  where id = p_event_id;

  return case when v_attempts >= 8 then 'dead_lettered' else 'retry_scheduled' end;
end;
$$;

create or replace function public.requeue_domain_outbox(
  p_event_id uuid,
  p_operator text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(nullif(btrim(p_operator), ''), '') = '' then
    raise exception 'operator is required' using errcode = '22023';
  end if;

  update public.domain_outbox
  set attempts = 0,
      available_at = now(),
      locked_at = null,
      locked_by = null,
      processed_at = null,
      dead_lettered_at = null,
      last_error = 'Requeued by ' || left(btrim(p_operator), 200)
  where id = p_event_id
    and dead_lettered_at is not null;
  return found;
end;
$$;

create or replace function public.get_domain_outbox_health()
returns table (
  pending_count bigint,
  ready_count bigint,
  leased_count bigint,
  dead_letter_count bigint,
  oldest_pending_seconds bigint,
  last_processed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where processed_at is null and dead_lettered_at is null),
    count(*) filter (
      where processed_at is null and dead_lettered_at is null
        and available_at <= now() and locked_at is null
    ),
    count(*) filter (
      where processed_at is null and dead_lettered_at is null and locked_at is not null
    ),
    count(*) filter (where dead_lettered_at is not null),
    coalesce(extract(epoch from now() - min(occurred_at) filter (
      where processed_at is null and dead_lettered_at is null
    ))::bigint, 0),
    max(processed_at)
  from public.domain_outbox;
$$;

revoke all on function public.claim_domain_outbox(text, integer, integer) from public, anon, authenticated;
revoke all on function public.fail_domain_outbox(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.requeue_domain_outbox(uuid, text) from public, anon, authenticated;
revoke all on function public.get_domain_outbox_health() from public, anon, authenticated;

grant execute on function public.claim_domain_outbox(text, integer, integer) to service_role;
grant execute on function public.fail_domain_outbox(uuid, text, text, integer) to service_role;
grant execute on function public.requeue_domain_outbox(uuid, text) to service_role;
grant execute on function public.get_domain_outbox_health() to service_role;
