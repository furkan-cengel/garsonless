-- Structured menu disclosure for ingredients, per-serving energy and allergens.
-- Existing products remain published; empty/default values are intentionally
-- incomplete until the restaurant explicitly reviews their food information.

alter table public.menu_items
  add column ingredients jsonb not null default '[]'::jsonb,
  add column energy_kcal integer,
  add column may_contain_allergens text[] not null default '{}'::text[],
  add column contains_alcohol boolean not null default false,
  add column contains_pork boolean not null default false,
  add column food_info_reviewed_at timestamptz,
  add column food_info_reviewed_by uuid references auth.users(id) on delete set null;

alter table public.menu_items
  add constraint menu_items_ingredients_array_check
    check (jsonb_typeof(ingredients) = 'array'),
  add constraint menu_items_energy_kcal_check
    check (energy_kcal is null or energy_kcal >= 0),
  add constraint menu_items_may_contain_allergens_check
    check (
      may_contain_allergens <@ array[
        'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
        'tree_nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin',
        'molluscs'
      ]::text[]
    );

comment on column public.menu_items.energy_kcal is
  'Total energy for one base serving, before modifier calorie deltas.';
comment on column public.menu_items.food_info_reviewed_at is
  'Restaurant acknowledgement that ingredient, energy and allergen data was reviewed.';
