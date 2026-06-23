-- Drop the temporary RLS introspection helper used to snapshot before/after the
-- Team & Roles Phase 1 rewrite. The real authorization helpers
-- (is_restaurant_owner / has_restaurant_access / has_restaurant_section /
-- menu_category_restaurant) are kept.

drop function if exists public.dump_affected_policies();
