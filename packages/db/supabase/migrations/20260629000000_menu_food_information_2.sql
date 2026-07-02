-- Menu food information — phase 2: nutrition macros, unit cost, dietary flags,
-- and an explicit "contains" allergen list. Extends 20260628000000 so the
-- redesigned product editor (NutritionFields) persists every field it shows.
--
-- Additive only, safe defaults, NO money/pricing impact (modifier_groups
-- untouched). Ingredient `amount` ("60g") lives inside the ingredients jsonb —
-- no column. `contains_allergens` = allergens the item DEFINITELY contains, vs
-- the existing `may_contain_allergens` = traces / cross-contact.
--
-- ⚠️ DEPLOY: apply to DEV now AND prod at deploy.

alter table public.menu_items
  add column cost numeric,
  add column protein_g numeric,
  add column carb_g numeric,
  add column fat_g numeric,
  add column is_vegetarian boolean not null default false,
  add column is_vegan boolean not null default false,
  add column is_halal boolean not null default false,
  add column contains_allergens text[] not null default '{}'::text[];

alter table public.menu_items
  add constraint menu_items_cost_check check (cost is null or cost >= 0),
  add constraint menu_items_protein_check check (protein_g is null or protein_g >= 0),
  add constraint menu_items_carb_check check (carb_g is null or carb_g >= 0),
  add constraint menu_items_fat_check check (fat_g is null or fat_g >= 0),
  add constraint menu_items_contains_allergens_check
    check (
      contains_allergens <@ array[
        'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
        'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin',
        'molluscs'
      ]::text[]
    );

comment on column public.menu_items.cost is
  'Unit cost for owner-only margin display. Never exposed to customers / anon.';
comment on column public.menu_items.contains_allergens is
  'Allergens the item DEFINITELY contains (vs may_contain_allergens = traces).';
comment on column public.menu_items.is_halal is
  'Owner-declared dietary flag; drives the customer halal filter.';
