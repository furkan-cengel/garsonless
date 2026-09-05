import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260901040000_subscription_renewal_invoice_hydration.sql', import.meta.url),
  'utf8',
)

test('renewal hydration pins provider plan identity and leases only missing invoice mappings', () => {
  assert.match(migration, /add column provider_plan_ref text/)
  assert.match(migration, /create function public\.sync_subscription_provider_plan_ref_from_checkout/)
  assert.match(migration, /discrepancy_code = 'provider_invoice_mapping_missing'/)
  assert.match(migration, /for update of job skip locked/)
})

test('hydration binds exact event, customer, subscription, order, plan, amount and period', () => {
  for (const error of [
    'billing_invoice_hydration_event_mismatch',
    'billing_invoice_hydration_subscription_mismatch',
    'billing_invoice_hydration_customer_mismatch',
    'billing_invoice_hydration_amount_mismatch',
    'billing_invoice_hydration_invoice_conflict',
  ]) assert.match(migration, new RegExp(error))
  assert.match(migration, /provider_invoice_ref = btrim\(p_provider_invoice_ref\)/)
  assert.match(migration, /v_subscription\.provider_plan_ref is distinct from btrim\(p_provider_plan_ref\)/)
})

test('signed renewal success and failure converge on existing atomic transitions', () => {
  assert.match(migration, /record_subscription_payment_success_atomic\(/)
  assert.match(migration, /record_subscription_payment_failure_atomic\(/)
  assert.match(migration, /current_period_start = p_period_start/)
  const failureBranch = migration.match(/else\n\s+v_transition := public\.record_subscription_payment_failure_atomic[\s\S]*?end if;/)?.[0] ?? ''
  assert.doesNotMatch(failureBranch, /current_period_start = p_period_start/)
})

test('hydration RPCs remain service-role-only', () => {
  assert.match(migration, /revoke all on function public\.claim_subscription_invoice_hydration[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.hydrate_subscription_invoice_from_provider_event[\s\S]*to service_role/)
})
