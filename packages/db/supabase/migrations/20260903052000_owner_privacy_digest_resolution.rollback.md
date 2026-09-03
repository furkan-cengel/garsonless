# Rollback note

This forward migration changes no table data or function signature. It only
resolves the existing pgcrypto function through the Supabase-managed
`extensions` schema and fixes the algorithm argument type.

Do not restore the prior unqualified `digest(bytea, unknown)` call: with the
function's fixed `public, pg_temp` search path it reintroduces the runtime and
database-lint failure. If this definition must be superseded, deploy another
forward `create or replace function` migration while retaining
`extensions.digest(..., 'sha256'::text)` and the existing service-role-only
grants.
