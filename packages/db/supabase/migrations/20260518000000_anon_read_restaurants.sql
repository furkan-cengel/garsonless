create policy "anon_read_restaurants"
  on restaurants for select
  using (deleted_at is null);
