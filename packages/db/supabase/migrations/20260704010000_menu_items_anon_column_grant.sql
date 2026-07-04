-- Keep restaurant-internal unit cost and nutrition macros out of the public
-- menu REST surface. A table-wide SELECT grant would override per-column
-- revokes, so replace it with an explicit public-menu allowlist.
-- Authenticated and service_role privileges are intentionally unchanged.

revoke select on public.menu_items from anon;

grant select (
  id,
  category_id,
  name,
  description,
  price,
  images,
  ingredients,
  energy_kcal,
  may_contain_allergens,
  contains_alcohol,
  contains_pork,
  contains_allergens,
  is_vegetarian,
  is_vegan,
  is_halal,
  food_info_reviewed_at,
  modifier_groups,
  earns_stamp,
  is_available,
  position,
  created_at,
  updated_at,
  deleted_at
) on public.menu_items to anon;
