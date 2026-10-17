# Customer visits from sessions recovery

The migration changes how two read-only RPCs count visits; no data is written. Visits now come from distinct bills with a non-cancelled order instead of loyalty `visit` rows. Loyalty rows are untouched, so earning rules are unaffected.

To restore the old count, re-run the `get_restaurant_customer_summary` body from `20260730040000_customer_detail_timeline_cursor.sql`, and patch `get_restaurant_customers` back by replacing `coalesce(ord.visits, 0) as visits,` with `coalesce(vis.visits, 0) as visits,` (the extra `visits` column in the `ord` CTE is harmless and may stay). The "Sık gelen" segment follows whichever definition is live. Production requires the existing target-specific backup/release process.
