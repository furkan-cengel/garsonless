-- Resolve several feature entitlement contexts in one round trip.
--
-- The dashboard layout checked ~11 features per page load with one RPC each.
-- This wrapper calls the existing read_restaurant_entitlement_context for every
-- requested feature inside one statement, so the entitlement rules stay in one
-- place and only the network round trips are collapsed.

create or replace function public.read_restaurant_entitlement_contexts(
  p_restaurant_id uuid,
  p_features text[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_restaurant_id is null or p_features is null or cardinality(p_features) > 32 then
    raise exception 'entitlement_features_invalid' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_object_agg(requested.feature, public.read_restaurant_entitlement_context(p_restaurant_id, requested.feature))
    from (select distinct unnest(p_features) as feature) requested
    where requested.feature is not null
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.read_restaurant_entitlement_contexts(uuid, text[]) from public, anon, authenticated;
grant execute on function public.read_restaurant_entitlement_contexts(uuid, text[]) to service_role;
