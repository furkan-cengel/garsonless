import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260722090000_platform_admin_foundation.sql', import.meta.url),
  'utf8',
).toLowerCase()

test('platform admin identities are isolated from tenant roles and public grants', () => {
  assert.match(sql, /create table public\.platform_admin_users/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table public\.platform_admin_users from public, anon, authenticated/)
  assert.doesNotMatch(sql, /restaurant_members|owner_id|is_staff_user/)
})

test('identity RPC is service-role only', () => {
  assert.match(sql, /security definer/)
  assert.match(sql, /revoke all on function public\.read_platform_admin_identity\(uuid\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.read_platform_admin_identity\(uuid\) to service_role/)
})

test('platform mutation audit is append-only and reasoned', () => {
  assert.match(sql, /reason text not null/)
  assert.match(sql, /request_id uuid not null/)
  assert.match(sql, /before update or delete on public\.platform_admin_audit_log/)
  assert.match(sql, /platform_admin_audit_is_append_only/)
})
