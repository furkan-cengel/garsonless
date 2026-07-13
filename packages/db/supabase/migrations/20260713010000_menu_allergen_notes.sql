alter table public.menu_items
  add column if not exists allergen_note text,
  add column if not exists cross_contact_note text;

alter table public.menu_items
  add constraint menu_items_allergen_note_length
    check (allergen_note is null or char_length(allergen_note) <= 500),
  add constraint menu_items_cross_contact_note_length
    check (cross_contact_note is null or char_length(cross_contact_note) <= 500);

comment on column public.menu_items.allergen_note is
  'Restaurant-authored allergen disclosure shown alongside structured allergen codes.';
comment on column public.menu_items.cross_contact_note is
  'Restaurant-authored possible cross-contact / trace disclosure.';
