-- The AR pointer tables bump menu_invalidations with their own table name as
-- the source; the original check only allowed the three catalog tables, so any
-- AR switch or publish failed. Widen the allowed sources.
alter table public.menu_invalidations
  drop constraint if exists menu_invalidations_source_check;
alter table public.menu_invalidations
  add constraint menu_invalidations_source_check check (source in (
    'menu_categories', 'menu_items', 'menu_item_recommendations',
    'menu_item_ar', 'restaurant_ar_access'
  ));
