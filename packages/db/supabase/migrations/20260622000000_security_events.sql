-- Per-user security activity log. Records REAL auth/security events for the
-- owner's account (login, password change). This is the source of truth for the
-- dashboard Security screen's audit log — no Supabase-internal tables relied on.
--
-- SCOPE: per-USER (the account). restaurant_id is optional so future team-scoped
-- events (e.g. member invite) can attribute a venue. IP/UA are mild PII, so this
-- table has NO anon policy. Service-role writes the events; each user can read
-- ONLY their own (user_id = auth.uid()). There is deliberately no insert/update/
-- delete policy for authenticated → a user can never forge or tamper with events.

create table security_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete set null,
  event_type    text not null check (event_type in ('login', 'password_change')),
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index security_events_user_id_created_at_idx
  on security_events (user_id, created_at desc);

alter table security_events enable row level security;

-- Each user reads ONLY their own events. Deliberately NO anon policy and NO
-- write policy → all inserts go through the service role (which bypasses RLS).
create policy "user_reads_own_security_events" on security_events
  for select to authenticated
  using (user_id = auth.uid());
