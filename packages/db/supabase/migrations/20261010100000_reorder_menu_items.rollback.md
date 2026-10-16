# Reorder menu items recovery

The migration adds one service-role-only function and changes no schema or existing data. Positions it writes are ordinary `menu_items.position` values that the dashboard already reads, so there is nothing to undo in data: a wrong order is fixed by dragging again (or by re-running the function with the intended order).

If the function itself must go, `drop function public.reorder_menu_items(uuid, uuid, uuid[])` is safe at any time; the dashboard's product drag and drop then reports a save error and leaves the previous order in place. Production requires the existing target-specific backup/release process.
