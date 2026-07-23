-- Forward fix: operational runtime verification and explicit data-retention
-- jobs need service-role deletion. Public/anon/authenticated remain revoked.
grant delete on table public.platform_admin_impersonation_sessions to service_role;
