import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722110000_platform_superadmin_bootstrap.sql', import.meta.url), 'utf8')

test('first superadmin bootstrap is atomic, exclusive and service-role only', () => {
  assert.match(sql, /create or replace function public\.bootstrap_platform_superadmin/)
  assert.match(sql, /lock table public\.platform_admin_users in exclusive mode/)
  assert.match(sql, /if exists \(select 1 from public\.platform_admin_users\)/)
  assert.match(sql, /revoke all on function public\.bootstrap_platform_superadmin[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.bootstrap_platform_superadmin[\s\S]+to service_role/)
})

test('bootstrap creates only an active superadmin and its reasoned audit in one function', () => {
  assert.match(sql, /'superadmin', 'active'/)
  assert.match(sql, /insert into public\.platform_admin_audit_log/)
  assert.match(sql, /'platform_admin\.bootstrap'/)
  assert.match(sql, /char_length\(btrim\(coalesce\(p_reason, ''\)\)\) not between 10 and 1000/)
  assert.doesNotMatch(sql, /support|finance|ops/)
})
