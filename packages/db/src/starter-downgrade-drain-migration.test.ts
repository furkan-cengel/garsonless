import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260827090000_starter_downgrade_drain.sql', import.meta.url),
  'utf8',
)

test('downgrade schedules while an adisyon is open and preserves the current plan', () => {
  assert.match(sql, /select count\(\*\)::integer into v_open_session_count[\s\S]+closed_at is null/)
  assert.match(sql, /if v_open_session_count > 0 then[\s\S]+scheduled_plan = p_plan/)
  assert.match(sql, /'plan', v_previous_plan[\s\S]+'scheduled', true/)
})

test('zero open adisyon and admin approval apply the plan atomically without deleting data', () => {
  assert.match(sql, /update public\.billing_subscriptions[\s\S]+scheduled_plan = null/)
  assert.match(sql, /update public\.restaurants[\s\S]+set plan = p_plan/)
  assert.doesNotMatch(sql, /delete from public\.(orders|customers|theme_configs|theme_drafts)/)
  assert.doesNotMatch(sql, /(?:update|delete from) public\.table_qr_tokens/)
  assert.doesNotMatch(sql, /rotate_table_qr_token/)
})

test('provider-managed subscriptions cannot drift through an admin downgrade', () => {
  assert.match(sql, /v_subscription\.provider = 'iyzico'[\s\S]+v_previous_plan <> p_plan/)
  assert.match(sql, /raise exception 'platform_tenant_plan_billing_managed'/)
})

test('draining blocks every new order and session but does not alter settlement or close paths', () => {
  assert.match(sql, /before insert on public\.orders/)
  assert.match(sql, /subscription_downgrade_draining/)
  assert.match(sql, /new_table_session_blocked/)
  assert.doesNotMatch(sql, /create or replace function public\.(close_table_session_atomic|settle)/)
})

test('transition and ingress functions are service-role only', () => {
  assert.match(sql, /revoke all on function public\.request_platform_admin_tenant_plan_transition[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.request_platform_admin_tenant_plan_transition[\s\S]+to service_role/)
  assert.match(sql, /revoke all on function public\.read_tenant_order_ingress_status[\s\S]+from public, anon, authenticated/)
})
