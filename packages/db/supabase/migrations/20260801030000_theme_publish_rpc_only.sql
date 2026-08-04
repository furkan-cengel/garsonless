-- Complete the publish boundary after legacy seed tooling moved to the
-- canonical RPC. Service-role application code may read current/history state,
-- but only the SECURITY DEFINER publish command may mutate it.

revoke insert, update, delete, truncate, references, trigger
  on table public.theme_configs
  from service_role;

revoke insert, update, delete, truncate, references, trigger
  on table public.theme_publish_operations
  from service_role;

revoke insert, update, delete, truncate, references, trigger
  on table public.theme_config_history
  from service_role;

grant select on table public.theme_configs to service_role;
grant select on table public.theme_publish_operations to service_role;
grant select on table public.theme_config_history to service_role;
