import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901070000_subscription_plan_change_renewal_convergence.sql', import.meta.url),
  'utf8',
)

test('webhook resolution accepts exact lineage while retired references stay reconciliation-only', () => {
  assert.match(sql, /billing_subscription_provider_refs/)
  assert.match(sql, /v_provider_ref\.ref_role = 'previous'/)
  assert.match(sql, /provider_subscription_reference_retired/)
  assert.match(sql, /provider_invoice_mapping_missing/)
})

test('target plan is applied only in the same transaction as exact paid renewal evidence', () => {
  assert.match(sql, /record_subscription_payment_success_with_plan_change_atomic/)
  assert.match(sql, /record_subscription_payment_success_atomic\([\s\S]*converge_paid_subscription_plan_change\(/)
  for (const binding of [
    'provider_target_subscription_ref', 'provider_target_plan_ref',
    'v_invoice.plan <> v_change.to_plan', 'v_invoice.amount_paid_minor <> v_invoice.amount_due_minor',
    'v_invoice.period_start is distinct from v_expected_period_start',
  ]) assert.match(sql, new RegExp(binding))
  assert.match(sql, /'billing:plan-changed:v1:' \|\| v_change\.id/)
})

test('paid downgrade preserves old entitlements until open sessions drain', () => {
  assert.match(sql, /v_result_status := 'paid_draining'/)
  assert.match(sql, /plan = v_change\.from_plan,[\s\S]*scheduled_plan = v_change\.to_plan/)
  assert.match(sql, /create function public\.apply_paid_subscription_plan_changes/)
  assert.match(sql, /session\.closed_at is null/)
})

test('success wrapper and bounded drain applier are service-role-only', () => {
  assert.match(sql, /revoke all on function public\.record_subscription_payment_success_with_plan_change_atomic[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.apply_paid_subscription_plan_changes[\s\S]*to service_role/)
})
