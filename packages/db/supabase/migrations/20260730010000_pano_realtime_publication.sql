-- Pano treats these rows only as tenant-scoped invalidation signals and then
-- rebuilds its authoritative snapshot through the server read-model boundary.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['payment_shares', 'service_requests'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
