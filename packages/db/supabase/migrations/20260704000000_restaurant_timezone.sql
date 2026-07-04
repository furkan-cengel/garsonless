-- Restaurant-local-day foundation: a first-class IANA timezone per restaurant.
--
-- WHY a column (not settings JSONB): the reporting layer computes "today" / day
-- boundaries on nearly every request; a NOT NULL DEFAULT backfills every existing
-- row atomically (maf-lounge, Test Cafe B → Europe/Istanbul) with zero scattered
-- app-side fallbacks — the same drift-elimination reasoning behind centralizing
-- the collected-ciro predicate. The value is validated + defaulted again at the
-- app boundary (restaurant-time reader falls back to Europe/Istanbul on garbage).
--
-- ANON: restaurants is anon-readable via the ROW policy anon_read_restaurants +
-- the menu's select('*') (this is why payment secrets live in a separate table).
-- So `timezone` WILL be anon-readable — which is fine: it is NOT a secret, and a
-- future menu "açık/kapalı" badge can use it. No grant change needed.
--
-- Turkey has had NO DST since 2016 (fixed UTC+3), so Istanbul day boundaries are
-- stable; the module is still general (DST-correct) for future non-TR expansion.

alter table public.restaurants
  add column if not exists timezone text not null default 'Europe/Istanbul';
