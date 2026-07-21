-- The dashboard bell badge subscribes to its own notification_inbox rows so
-- the unread count rises/falls live. postgres_changes honours RLS, so each
-- user only ever receives their own inbox events. Add the table to the
-- realtime publication (idempotent).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_inbox'
  ) then
    alter publication supabase_realtime add table public.notification_inbox;
  end if;
end $$;
