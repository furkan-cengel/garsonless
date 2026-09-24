# Batched entitlement contexts recovery

The migration only adds a read-only wrapper; no data is written and the existing `read_restaurant_entitlement_context` is unchanged. The application falls back to one call per feature whenever the batched RPC errors, so dropping it with `drop function public.read_restaurant_entitlement_contexts(uuid, text[])` is safe at any time and only restores the previous number of round trips. Production requires the existing target-specific backup/release process.
