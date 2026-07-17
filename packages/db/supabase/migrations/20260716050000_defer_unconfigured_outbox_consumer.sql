-- Safe staged rollout: if an event needs a Node consumer but that consumer URL
-- is not configured yet, the Edge worker must neither ACK/drop it nor exhaust
-- the poison-event retry budget. Deferral releases the lease and compensates
-- the claim attempt until deployment wiring is complete.

create or replace function public.defer_domain_outbox(
  p_event_id uuid,
  p_worker text,
  p_reason text,
  p_delay_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated uuid;
begin
  update public.domain_outbox
  set attempts = greatest(attempts - 1, 0),
      available_at = now() + make_interval(secs => greatest(p_delay_seconds, 60)),
      locked_at = null,
      locked_by = null,
      last_error = left(coalesce(p_reason, 'Consumer is not configured'), 1000)
  where id = p_event_id
    and processed_at is null
    and dead_lettered_at is null
    and locked_by = p_worker
  returning id into v_updated;
  return v_updated is not null;
end;
$$;

revoke all on function public.defer_domain_outbox(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.defer_domain_outbox(uuid, text, text, integer)
  to service_role;
