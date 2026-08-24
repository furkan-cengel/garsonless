-- Orders consumes the shared tenant-scoped invalidation metadata instead of
-- receiving full order rows (including item snapshots) over Realtime.

drop policy if exists pano_invalidations_read on public.pano_invalidations;
create policy pano_invalidations_read on public.pano_invalidations
  for select to authenticated
  using (
    public.has_restaurant_section(restaurant_id, 'pano')
    or public.has_restaurant_section(restaurant_id, 'tables')
    or public.has_restaurant_section(restaurant_id, 'orders')
  );
