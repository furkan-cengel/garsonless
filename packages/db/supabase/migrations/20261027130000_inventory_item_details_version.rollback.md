# Rollback: 20261027130000_inventory_item_details_version

Adds `inventory_items.details_version` and redefines `inventory_snapshot` (returns
`detailsVersion`) and `execute_inventory` (an item edit that sends `detailsVersion` is checked
against it; edits also bump it). Grants are unchanged because both use `create or replace`.

Down migrations are not used; fix forward. To restore the old behavior, re-run the two
function bodies from `20260917150000_inventory_foundation.sql` and
`20260917151000_inventory_commands.sql` in a new migration; the dashboard then falls back to
the old conflict check because the snapshot no longer returns `detailsVersion`. The column can
stay; dropping it requires those function bodies to be restored first. No data is changed.
