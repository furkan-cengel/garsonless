# Public restaurant projection rollback

This migration intentionally removes direct anonymous reads from
`public.restaurants`. Rolling it back restores a known privacy weakness and
must only be used as a short emergency bridge.

1. Keep `read_public_restaurant_by_slug(text)` deployed while the previous menu
   artifact is restored.
2. If the previous artifact still reads the base table, temporarily restore a
   column-scoped compatibility view or the old policy only after confirming no
   private data exists in `restaurants.settings`.
3. Remove the temporary access immediately after redeploying the projection-aware
   menu artifact.
4. Verify as `anon` that `owner_id`, `plan`, billing data and tax data remain
   unreadable before ending the incident.

Do not drop the projection first: doing so would turn a rollback into an outage
for every public menu.
