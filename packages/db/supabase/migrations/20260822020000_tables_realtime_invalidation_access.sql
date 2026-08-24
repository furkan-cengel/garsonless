-- The operational invalidation row contains only a tenant id, monotonic
-- version, source name and timestamp. Tables may consume that same narrow
-- boundary without receiving full order, session, payment or request rows.

drop policy if exists pano_invalidations_read on public.pano_invalidations;
create policy pano_invalidations_read on public.pano_invalidations
  for select to authenticated
  using (
    public.has_restaurant_section(restaurant_id, 'pano')
    or public.has_restaurant_section(restaurant_id, 'tables')
  );
