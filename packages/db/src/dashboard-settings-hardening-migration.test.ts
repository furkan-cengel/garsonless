import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/20260824040000_dashboard_settings_hardening.sql', import.meta.url), 'utf8')

test('settings hardening relations are force-RLS and do not store secret/export documents', () => {
  for (const table of ['restaurant_settings_revisions', 'restaurant_timezone_requests', 'restaurant_integration_health', 'tenant_privacy_operations', 'dashboard_auth_rate_limits']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`, 'i'))
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'i'))
  }
  assert.doesNotMatch(migration, /export_document|credential|secret_key|api_key/i)
})

test('settings invalidation is narrow and tenant-authorized', () => {
  assert.match(migration, /has_restaurant_section\(restaurant_id, 'settings'\)/)
  assert.match(migration, /after update of settings, timezone on public\.restaurants/i)
  assert.match(migration, /alter publication supabase_realtime add table public\.restaurant_settings_revisions/i)
  assert.match(migration, /restaurant_members replica identity full[\s\S]*alter publication supabase_realtime add table public\.restaurant_members/i)
  assert.match(migration, /update_restaurant_timezone_cas[\s\S]*pg_advisory_xact_lock[\s\S]*for update/i)
  assert.match(migration, /restaurant_timezone_requests[\s\S]*primary key \(restaurant_id, request_id\)/i)
})

test('privacy and rate-limit functions are service-role only and replay-safe', () => {
  assert.match(migration, /request_id uuid not null unique/i)
  assert.match(migration, /grant execute on function public\.request_tenant_privacy_operation[\s\S]*to service_role/i)
  assert.match(migration, /grant execute on function public\.consume_dashboard_auth_rate_limit[\s\S]*to service_role/i)
  assert.match(migration, /export_owner_tenant_privacy_data[\s\S]*result_digest/i)
  assert.match(migration, /digest\(convert_to\(v_document::text, 'utf8'\), 'sha256'\)/i)
  assert.doesNotMatch(migration, /as \$\$\s*as \$\$/i)
})

test('team mutation and audit are one database transaction and security retention is automatic', () => {
  assert.match(migration, /create or replace function public\.mutate_team_member_with_audit/i)
  assert.match(migration, /update public\.restaurant_members[\s\S]*insert into public\.security_events/i)
  assert.match(migration, /grant execute on function public\.mutate_team_member_with_audit[\s\S]*to service_role/i)
  assert.match(migration, /prune_dashboard_security_events/i)
  assert.match(migration, /180 days/i)
  assert.match(migration, /365 days/i)
})
