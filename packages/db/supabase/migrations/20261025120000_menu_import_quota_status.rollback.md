# Rollback: 20261025120000_menu_import_quota_status

Redefines `enqueue_menu_import` (failed reads no longer count toward the 5 reads per
restaurant per 24 hours) and `read_menu_imports` (adds `categories` and `quota`). Grants
are unchanged because both are `create or replace`.

Down migrations are not used; fix forward. To restore the previous behavior, re-run the two
function definitions from `20261012140000_guided_menu_import.sql` in a new migration. The
dashboard treats a missing `quota` or `categories` as unknown, so older function bodies stay
compatible with the current UI. No data is changed by this migration.
