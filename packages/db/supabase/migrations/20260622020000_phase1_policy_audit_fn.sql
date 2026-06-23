-- TEMPORARY introspection helper for the Team & Roles Phase 1 RLS rewrite.
-- Returns pg_policies for the affected tables as jsonb so the before/after RLS
-- state can be snapshotted + diffed (no Docker/psql in this env). service_role
-- only. Dropped immediately after the rewrite by 20260622040000.

create or replace function public.dump_affected_policies()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname), '[]'::jsonb)
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in (
      'restaurants','restaurant_members','tables','table_sessions',
      'menu_categories','menu_items','orders','theme_configs','service_requests',
      'loyalty_transactions','customer_segments','campaigns',
      'payment_credentials','kitchen_credentials'
    );
$$;

revoke execute on function public.dump_affected_policies() from public, anon, authenticated;
grant execute on function public.dump_affected_policies() to service_role;
