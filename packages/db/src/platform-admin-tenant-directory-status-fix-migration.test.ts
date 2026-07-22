import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722120000_platform_admin_tenant_directory_status_fix.sql', import.meta.url), 'utf8')

test('forward fix filters the lateral subscription through its actual status column', () => {
  assert.match(sql, /p_subscription_status = 'none' and bs\.status is null/)
  assert.match(sql, /or bs\.status = p_subscription_status/)
  assert.doesNotMatch(sql, /bs\.subscription_status/)
})

test('forward fix preserves service-only access, bounds and safe projection', () => {
  assert.match(sql, /p_limit not between 1 and 50/)
  assert.match(sql, /revoke all on function public\.list_platform_admin_tenants[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.list_platform_admin_tenants[\s\S]+to service_role/)
  for (const forbidden of ["'ownerId'", "'contactEmail'", "'settings'", "'provider'"]) {
    assert.doesNotMatch(sql, new RegExp(forbidden))
  }
})
