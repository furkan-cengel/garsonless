-- Table sessions (adisyon): one open session per table, opened lazily on the
-- first order, closed by the restaurant (or lazily after 8h inactivity).
-- NOTE: orders.session_id is the DEVICE session (cart uuid) — the table
-- session FK is the separate column table_session_id.
-- Anon read depends on the 24h anon orders policy; the 8h lazy auto-close
-- keeps open sessions well inside that window.

create table table_sessions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_id      uuid not null references tables(id) on delete cascade,
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index table_sessions_one_open_per_table
  on table_sessions(table_id) where closed_at is null;

alter table orders add column table_session_id uuid
  references table_sessions(id) on delete set null;

create index orders_table_session_idx
  on orders(table_session_id) where table_session_id is not null;

alter table table_sessions enable row level security;

create policy "owner_manage_table_sessions" on table_sessions
  for all to authenticated
  using (exists (
    select 1 from restaurants r
    where r.id = table_sessions.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ))
  with check (exists (
    select 1 from restaurants r
    where r.id = table_sessions.restaurant_id
      and r.owner_id = auth.uid()
      and r.deleted_at is null
  ));

-- Menu app discovers the open session for a table; closed sessions invisible.
create policy "anon_read_open_table_sessions" on table_sessions
  for select to anon
  using (closed_at is null);

-- Atomic open-or-get; resolves the two-devices-first-order race via the
-- partial unique index. Also lazily closes a stale session first.
create or replace function open_or_get_table_session(p_restaurant_id uuid, p_table_id uuid)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  update table_sessions s set closed_at = now(), updated_at = now()
  where s.table_id = p_table_id and s.closed_at is null
    and s.opened_at < now() - interval '8 hours'
    and not exists (
      select 1 from orders o
      where o.table_session_id = s.id
        and o.created_at > now() - interval '8 hours'
    );

  insert into table_sessions (restaurant_id, table_id)
  values (p_restaurant_id, p_table_id)
  on conflict (table_id) where (closed_at is null) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from table_sessions
    where table_id = p_table_id and closed_at is null
    limit 1;
  end if;

  return v_id;
end $$;

-- Service-role only: anon must not be able to open ghost sessions via
-- the PostgREST rpc endpoint.
revoke execute on function open_or_get_table_session(uuid, uuid) from public;
revoke execute on function open_or_get_table_session(uuid, uuid) from anon, authenticated;
