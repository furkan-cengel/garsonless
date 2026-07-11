-- QR stand request abuse protection. One atomic throttle slot per restaurant;
-- service-role only (the dashboard action authenticates + authorizes first).

create table public.qr_stand_request_limits (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  last_requested_at timestamptz not null default now()
);

alter table public.qr_stand_request_limits enable row level security;
-- Deliberately no anon/authenticated policies.

create or replace function public.claim_qr_stand_request_slot(
  p_restaurant_id uuid,
  p_requested_by uuid,
  p_window_seconds integer default 600
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  claimed_at timestamptz := clock_timestamp();
  result_at timestamptz;
begin
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid throttle window';
  end if;

  insert into public.qr_stand_request_limits (
    restaurant_id, requested_by, last_requested_at
  ) values (
    p_restaurant_id, p_requested_by, claimed_at
  )
  on conflict (restaurant_id) do update
    set requested_by = excluded.requested_by,
        last_requested_at = excluded.last_requested_at
    where qr_stand_request_limits.last_requested_at
      <= clock_timestamp() - make_interval(secs => p_window_seconds)
  returning last_requested_at into result_at;

  return result_at; -- null means throttled
end;
$$;

revoke all on table public.qr_stand_request_limits from public, anon, authenticated;
revoke execute on function public.claim_qr_stand_request_slot(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_qr_stand_request_slot(uuid, uuid, integer)
  to service_role;

