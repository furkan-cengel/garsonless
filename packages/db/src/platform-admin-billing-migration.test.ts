import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/migrations/20260722150000_platform_tenant_billing_timeline.sql', import.meta.url), 'utf8')

test('billing timeline re-verifies finance or superadmin identity and bounds the read', () => {
  assert.match(sql, /v_identity\.status <> 'active'/)
  assert.match(sql, /v_identity\.role <> p_actor_role/)
  assert.match(sql, /v_identity\.role not in \('finance', 'superadmin'\)/)
  assert.match(sql, /p_limit not between 1 and 100/)
  assert.match(sql, /limit p_limit/)
})

test('billing timeline is tenant-scoped across every operational source', () => {
  for (const table of [
    'subscription_invoices',
    'subscription_payment_attempts',
    'dunning_runs',
    'billing_reconciliation_jobs',
    'billing_provider_events',
    'billing_provider_operations',
  ]) {
    assert.match(sql, new RegExp(`from public\\.${table}[\\s\\S]+restaurant_id = p_restaurant_id`))
  }
})

test('safe projection omits PII, provider references, payloads and raw diagnostics', () => {
  for (const forbidden of [
    'contact_email',
    'identity_number',
    'provider_event_id',
    'provider_attempt_ref',
    'provider_checkout_ref',
    'provider_payment_ref',
    'provider_subscription_ref',
    'payload_sanitized',
    'result_sanitized',
    'idempotency_key',
    'request_fingerprint',
    'last_error',
    'failure_message',
    'provider_snapshot_sanitized',
    'local_snapshot',
  ]) assert.doesNotMatch(sql, new RegExp(`\\b${forbidden}\\b`))
})

test('billing timeline RPC is service-role only', () => {
  assert.match(sql, /revoke all on function public\.read_platform_admin_tenant_billing_timeline\(uuid,uuid,text,integer\)[\s\S]+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.read_platform_admin_tenant_billing_timeline\(uuid,uuid,text,integer\)[\s\S]+to service_role/)
})
