import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260901061000_subscription_plan_change_ledger_hardening.sql', import.meta.url),
  'utf8',
)

test('change-request audit can outlive a deleted operation without circular cleanup', () => {
  assert.match(sql, /foreign key \(provider_operation_id\)[\s\S]*on delete set null/)
})

test('successful reconciliation recovery closes only its exact provider operation job', () => {
  assert.match(sql, /old\.status = 'requires_reconciliation'/)
  assert.match(sql, /dedupe_key = 'provider-operation:' \|\| new\.provider_operation_id/)
  assert.match(sql, /status = 'resolved'/)
  assert.match(sql, /'providerTargetSubscriptionRef', new\.provider_target_subscription_ref/)
})
