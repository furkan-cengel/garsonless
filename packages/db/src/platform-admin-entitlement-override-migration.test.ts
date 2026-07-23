import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722170000_tenant_feature_overrides.sql', import.meta.url), 'utf8')

test('feature override projection is closed, bounded and service-role-only', () => {
  assert.match(sql, /create table public\.tenant_feature_overrides/)
  assert.match(sql, /decision text not null check \(decision in \('allow', 'deny'\)\)/)
  assert.match(sql, /expires_at > updated_at/)
  assert.match(sql, /expires_at <= updated_at \+ interval '30 days 5 minutes'/)
  assert.match(sql, /revoke all on table public\.tenant_feature_overrides from public, anon, authenticated/)
  assert.match(sql, /grant select, insert, update, delete on table public\.tenant_feature_overrides to service_role/)
  assert.doesNotMatch(sql, /'orders'/)
  assert.match(sql, /'browser_notifications', 'kitchen_display', 'loyalty'/)
})

test('runtime resolver only returns unexpired projections and is service-role-only', () => {
  assert.match(sql, /feature_override\.expires_at > now\(\)/)
  assert.match(sql, /revoke all on function public\.read_active_tenant_feature_override\(uuid,text\)[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.read_active_tenant_feature_override\(uuid,text\)[\s\S]+to service_role/)
})

test('platform reads reverify an active exact-role identity', () => {
  assert.match(sql, /create or replace function public\.read_platform_admin_tenant_feature_overrides/)
  assert.match(sql, /v_identity\.status <> 'active'/)
  assert.match(sql, /v_identity\.role <> p_actor_role/)
})

test('mutations are ops-superadmin only, replay-safe and append-only audited', () => {
  assert.match(sql, /v_identity\.role not in \('ops', 'superadmin'\)/)
  assert.match(sql, /action = 'tenant\.entitlement_override\.change'/)
  assert.match(sql, /request_id = p_request_id/)
  assert.match(sql, /insert into public\.platform_admin_audit_log/)
  assert.match(sql, /before_state, after_state/)
  assert.match(sql, /on conflict \(restaurant_id, feature\) do update/)
  assert.match(sql, /delete from public\.tenant_feature_overrides/)
})

test('mutation RPC is not callable by browser roles', () => {
  assert.match(sql, /revoke all on function public\.change_platform_admin_tenant_feature_override\(uuid,uuid,text,text,text,text,integer,text,uuid\)[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.change_platform_admin_tenant_feature_override\(uuid,uuid,text,text,text,text,integer,text,uuid\)[\s\S]+to service_role/)
})

test('override migration never mutates plan, subscription, invoice or provider operation authority', () => {
  assert.doesNotMatch(sql, /update public\.restaurants[\s\S]+set plan/)
  assert.doesNotMatch(sql, /update public\.billing_subscriptions/)
  assert.doesNotMatch(sql, /update public\.subscription_invoices/)
  assert.doesNotMatch(sql, /insert into public\.billing_provider_operations/)
})
