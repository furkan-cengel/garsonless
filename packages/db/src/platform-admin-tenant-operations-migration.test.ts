import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722130000_platform_tenant_service_controls.sql', import.meta.url), 'utf8')

test('tenant service controls are isolated and backward-compatible', () => {
  assert.match(sql, /create table public\.tenant_service_controls/)
  assert.match(sql, /status in \('active', 'suspended', 'manual_hold'\)/)
  assert.match(sql, /coalesce\(v_control\.status, 'active'\)/)
  assert.match(sql, /revoke all on table public\.tenant_service_controls from public, anon, authenticated/)
})

test('platform lifecycle mutation re-verifies role and writes audit atomically', () => {
  assert.match(sql, /v_identity\.status <> 'active'/)
  assert.match(sql, /v_identity\.role not in \('ops', 'superadmin'\)/)
  assert.match(sql, /char_length\(btrim\(coalesce\(p_reason, ''\)\)\) not between 10 and 1000/)
  assert.match(sql, /insert into public\.platform_admin_audit_log/)
  assert.match(sql, /before_state, after_state/)
  assert.match(sql, /request_id = p_request_id/)
})

test('tenant service RPCs are service-role only', () => {
  assert.match(sql, /revoke all on function public\.read_platform_admin_tenant_service_control\(uuid\)[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /revoke all on function public\.set_platform_admin_tenant_service_status\(uuid,uuid,text,text,text,uuid\)[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.set_platform_admin_tenant_service_status\(uuid,uuid,text,text,text,uuid\)[\s\S]+to service_role/)
})
