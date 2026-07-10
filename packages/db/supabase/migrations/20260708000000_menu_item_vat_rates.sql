-- VAT/KDV support is additive: menu prices stay VAT-inclusive; these rates are
-- captured into each order-line snapshot at order time for receipt breakdowns.

alter table public.menu_categories
  add column if not exists vat_rate numeric(5,2) not null default 10
  check (vat_rate >= 0 and vat_rate <= 100);

alter table public.menu_items
  add column if not exists vat_rate numeric(5,2)
  check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));
