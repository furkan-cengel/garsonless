-- The Canlı Masalar surface treats table row changes as invalidation signals.
-- Authenticated staff still rebuild the authoritative tenant-scoped directory
-- through the server action; realtime payloads never become trusted UI state.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tables'
  ) then
    alter publication supabase_realtime add table public.tables;
  end if;
end;
$$;
