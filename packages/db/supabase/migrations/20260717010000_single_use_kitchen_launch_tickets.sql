-- KDS launch tickets are short-lived but must also be single-use. Only a hash
-- of the signed artifact is persisted; the bearer artifact itself never enters
-- Postgres. The consume RPC atomically gives one concurrent exchange the win.

create table if not exists public.kitchen_session_launches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ticket_hash text not null unique check (char_length(ticket_hash) = 64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kitchen_session_launches_restaurant_expiry
  on public.kitchen_session_launches (restaurant_id, expires_at);

alter table public.kitchen_session_launches enable row level security;
revoke all on table public.kitchen_session_launches from public, anon, authenticated;
grant select, insert, update, delete on table public.kitchen_session_launches to service_role;

create or replace function public.consume_kitchen_launch_ticket(
  p_restaurant_id uuid,
  p_ticket_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consumed_id uuid;
begin
  update public.kitchen_session_launches
  set consumed_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where restaurant_id = p_restaurant_id
    and ticket_hash = p_ticket_hash
    and consumed_at is null
    and expires_at > clock_timestamp()
  returning id into v_consumed_id;

  return v_consumed_id is not null;
end;
$$;

revoke all on function public.consume_kitchen_launch_ticket(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_kitchen_launch_ticket(uuid, text)
  to service_role;
