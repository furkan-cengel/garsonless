# Rollback: 20261028100000_inventory_insights

Adds the read-only `inventory_insights(uuid)` function (service-role only). It changes no data
and no existing function.

Down migrations are not used; fix forward. `drop function public.inventory_insights(uuid);`
removes it. The dashboard treats a missing function as "no insights" and still renders the
stock screen, without daily use, waste totals, last purchase or per-item history.
