-- Add orders to the supabase_realtime publication.
-- Without this, postgres_changes subscriptions (dashboard badge/board,
-- kitchen KDS, menu order-status tracking) connect but never receive events.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
