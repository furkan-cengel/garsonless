import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260902012000_subscription_add_on_checkout_plan_binding_fix.sql', import.meta.url),
  'utf8',
)

test('add-on checkout no longer reads or inserts a nonexistent provider-plan column', () => {
  assert.doesNotMatch(sql, /v_existing\.expected_provider_plan_ref/)
  assert.doesNotMatch(sql, /due_at,\s*expected_provider_plan_ref/)
  assert.match(sql, /result_sanitized \? 'expectedProviderPlanRef'/)
  assert.match(sql, /result_sanitized->>'expectedProviderPlanRef'[\s\S]*is distinct from btrim\(p_expected_provider_plan_ref\)/)
})

test('add-on checkout remains exact-bound to the active provider catalogue', () => {
  assert.match(sql, /where add_on = p_add_ons\[1\]/)
  assert.match(sql, /and plan = p_plan/)
  assert.match(sql, /and billing_interval = p_billing_interval/)
  assert.match(sql, /and active = true/)
  assert.match(sql, /v_catalog\.provider_gross_amount_minor <> p_amount_minor/)
  assert.match(sql, /v_catalog\.provider_plan_ref <> btrim\(p_expected_provider_plan_ref\)/)
})

test('add-on checkout repair preserves service-role-only execution', () => {
  assert.match(sql, /revoke all on function public\.prepare_subscription_checkout_with_add_ons_operation\([\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.prepare_subscription_checkout_with_add_ons_operation\([\s\S]*to service_role/)
})
