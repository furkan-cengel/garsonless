import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260731110000_saas_billing_checkout_plan_binding.sql', import.meta.url),
  'utf8',
)

test('checkout callback lookup returns the durably claimed plan and stays service-role only', () => {
  assert.match(migration, /create function public\.bind_subscription_checkout_provider_plan/)
  assert.match(migration, /'expectedProviderPlanRef', btrim\(p_expected_provider_plan_ref\)/)
  assert.match(migration, /result_sanitized = result_sanitized \|\| jsonb_build_object/)
  assert.match(migration, /operation_type = 'checkout\.initialize'/)
  assert.match(migration, /'requestedPlan', v_operation\.requested_plan/)
  assert.match(migration, /'expectedProviderPlanRef', v_expected_provider_plan_ref/)
  assert.match(migration, /billing_checkout_plan_binding_missing/)
  assert.match(migration, /billing_checkout_provider_plan_mismatch/)
  assert.match(migration, /create trigger enforce_billing_checkout_plan_binding/)
  assert.match(migration, /revoke all on function public\.bind_subscription_checkout_provider_plan\(uuid, text\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.find_subscription_checkout_callback\(text\)[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.find_subscription_checkout_callback\(text\)[\s\S]*to service_role/)
})
