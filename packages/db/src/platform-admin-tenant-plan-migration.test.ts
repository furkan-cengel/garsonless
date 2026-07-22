import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722140000_platform_tenant_plan_management.sql', import.meta.url), 'utf8')

test('tenant plan mutation is closed to the canonical plan vocabulary', () => {
  assert.match(sql, /not in \('free', 'starter', 'pro', 'enterprise'\)/)
  assert.match(sql, /char_length\(btrim\(coalesce\(p_reason, ''\)\)\) not between 10 and 1000/)
})

test('database re-verifies active superadmin identity', () => {
  assert.match(sql, /v_identity\.status <> 'active'/)
  assert.match(sql, /v_identity\.role <> p_actor_role/)
  assert.match(sql, /v_identity\.role <> 'superadmin'/)
})

test('live provider-managed subscriptions block divergent plan changes', () => {
  assert.match(sql, /from public\.billing_subscriptions/)
  assert.match(sql, /status <> 'cancelled'/)
  assert.match(sql, /v_subscription\.id is not null and v_changed/)
  assert.match(sql, /platform_tenant_plan_billing_managed/)
})

test('plan and append-only audit are written in one transaction with replay', () => {
  assert.match(sql, /update public\.restaurants[\s\S]+set plan = p_plan/)
  assert.match(sql, /action = 'tenant\.plan\.change'/)
  assert.match(sql, /request_id = p_request_id/)
  assert.match(sql, /insert into public\.platform_admin_audit_log/)
  assert.match(sql, /before_state, after_state/)
})

test('tenant plan RPC is service-role only', () => {
  assert.match(sql, /revoke all on function public\.set_platform_admin_tenant_plan\(uuid,uuid,text,text,text,uuid\)[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.set_platform_admin_tenant_plan\(uuid,uuid,text,text,text,uuid\)[\s\S]+to service_role/)
})
