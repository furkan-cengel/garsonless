# Rollback: 20261028120000_inventory_suppliers_reorder_undo

Adds `inventory_items.supplier` and `order_unit`, the `inventory_reorders` table (service-role
only), the `reorder` and `reverse` modes of `execute_inventory`, and `supplier`/`orderUnit`/
`reorders` in `inventory_snapshot` plus `unavailableMenuItems`/`foodCost` in
`inventory_insights`. Grants are unchanged because all three functions use `create or replace`.

Down migrations are not used; fix forward. To restore the previous behavior, re-run
`execute_inventory` and `inventory_snapshot` from `20261027130000_inventory_item_details_version.sql`
and `inventory_insights` from `20261028100000_inventory_insights.sql` in a new migration; the
dashboard hides suppliers, the reorder list's sent marks, undo and food cost when the fields are
absent. Reversal documents already written stay in the ledger (it is immutable); they are ordinary
opposite movements. The new columns and table can stay. No existing data is changed.
