import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722160000_platform_billing_dunning_interventions.sql', import.meta.url), 'utf8')

test('dunning intervention has a closed command and bounded defer contract', () => {
  assert.match(sql, /not in \('retry_now', 'defer'\)/)
  assert.match(sql, /p_defer_days not between 1 and 30/)
  assert.match(sql, /p_intervention = 'retry_now' and p_defer_days is not null/)
  assert.match(sql, /char_length\(btrim\(coalesce\(p_reason, ''\)\)\) not between 10 and 1000/)
})

test('database re-verifies finance or superadmin identity and tenant ownership', () => {
  assert.match(sql, /v_identity\.status <> 'active'/)
  assert.match(sql, /v_identity\.role <> p_actor_role/)
  assert.match(sql, /v_identity\.role not in \('finance', 'superadmin'\)/)
  assert.match(sql, /where id = p_invoice_id and restaurant_id = p_restaurant_id/)
  assert.match(sql, /where invoice_id = p_invoice_id and restaurant_id = p_restaurant_id/)
})

test('intervention cannot override payment authority or an active worker lease', () => {
  assert.match(sql, /v_invoice\.status <> 'past_due'/)
  assert.match(sql, /v_subscription\.status not in \('past_due', 'grace_period'\)/)
  assert.match(sql, /v_run\.status = 'running'/)
  assert.match(sql, /platform_dunning_run_busy/)
  assert.doesNotMatch(sql, /update public\.subscription_invoices/)
  assert.doesNotMatch(sql, /update public\.billing_subscriptions/)
  assert.doesNotMatch(sql, /update public\.restaurants set plan/)
  assert.doesNotMatch(sql, /billing_provider_operations|provider_payment_ref/)
})

test('scheduling update and append-only audit share one replay-safe transaction', () => {
  assert.match(sql, /action = v_action/)
  assert.match(sql, /request_id = p_request_id/)
  assert.match(sql, /update public\.dunning_runs[\s\S]+set status = 'scheduled'/)
  assert.match(sql, /insert into public\.platform_admin_audit_log/)
  assert.match(sql, /before_state, after_state/)
})

test('dunning intervention RPC is service-role only', () => {
  assert.match(sql, /revoke all on function public\.intervene_platform_admin_billing_dunning\(uuid,uuid,uuid,text,text,integer,text,uuid\)[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.intervene_platform_admin_billing_dunning\(uuid,uuid,uuid,text,text,integer,text,uuid\)[\s\S]+to service_role/)
})
