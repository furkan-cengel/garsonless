-- Masalar ekranı masa doluluk durumunu ve açık adisyonları sayfa yenilemeden
-- günceller. RLS görünürlüğü değiştirilmez; publication yalnız mevcut SELECT
-- politikalarının izin verdiği authenticated kullanıcılara olay taşır.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_sessions'
  ) then
    alter publication supabase_realtime add table public.table_sessions;
  end if;
end $$;
