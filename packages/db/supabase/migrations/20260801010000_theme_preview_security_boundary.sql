-- Public menu reads published theme tokens through the service-role application
-- adapter. The backing row also contains tenant and publisher metadata, so it
-- must never be directly queryable by anonymous clients.
drop policy if exists "anon_read_theme_configs" on public.theme_configs;

revoke select on table public.theme_configs from anon;
