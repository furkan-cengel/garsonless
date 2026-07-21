-- The public menu query selects allergen_note and cross_contact_note, but the
-- anon column allowlist from 20260704010000 predates these columns (added in
-- 20260713010000). PostgREST rejects the whole select with 42501, which the
-- menu app rendered as an empty menu on theme preview and table QR pages.
-- Both columns are restaurant-authored public allergen disclosure text and are
-- deliberately part of the customer-facing surface; sensitive columns
-- (cost, macros, settlement fields) remain excluded from the anon grant.

grant select (allergen_note, cross_contact_note) on public.menu_items to anon;
