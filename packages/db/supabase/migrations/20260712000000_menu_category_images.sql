alter table public.menu_categories
  add column if not exists image_url text;

comment on column public.menu_categories.image_url is
  'Optional public category artwork used by visual menu navigation.';
