-- Limit authenticated reads of menu_items to the public menu columns.
--
-- anon already has a column allowlist, but authenticated kept the table-wide
-- SELECT from Supabase's default privileges. The public row policy
-- (available, not deleted) applies to every role, and menu customers sign in
-- to the same project, so any signed-in customer could read cost, macros, VAT
-- rate, kitchen station and the reviewing staff member of every restaurant's
-- items. Staff screens that read through the authenticated client only select
-- public columns, and menu writes go through the service role, so the
-- authenticated allowlist can match anon's exactly.

revoke select on public.menu_items from authenticated;

grant select (
  id,
  category_id,
  name,
  description,
  price,
  images,
  modifier_groups,
  is_available,
  position,
  created_at,
  updated_at,
  deleted_at,
  earns_stamp,
  ingredients,
  energy_kcal,
  may_contain_allergens,
  contains_alcohol,
  contains_pork,
  food_info_reviewed_at,
  is_vegetarian,
  is_vegan,
  is_halal,
  contains_allergens,
  allergen_note,
  cross_contact_note
) on public.menu_items to authenticated;
