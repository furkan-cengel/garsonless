import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260902011000_subscription_checkout_reconciliation_resolution.sql', import.meta.url),
  'utf8',
)

test('authenticated checkout finalization resolves only its exact provider-operation job', () => {
  assert.match(migration, /new\.operation_type = 'checkout\.initialize'/)
  assert.match(migration, /new\.status = 'succeeded'/)
  assert.match(migration, /old\.status = 'requires_reconciliation'/)
  assert.match(migration, /where dedupe_key = 'provider-operation:' \|\| new\.id/)
  assert.match(migration, /'resolvedBy', 'authenticated_checkout_retrieve'/)
})

test('historical cleanup requires an exact fully-paid checkout invoice', () => {
  assert.match(migration, /operation\.operation_type = 'checkout\.initialize'/)
  assert.match(migration, /operation\.status = 'succeeded'/)
  assert.match(migration, /invoice\.status = 'paid'/)
  assert.match(migration, /invoice\.amount_paid_minor = invoice\.amount_due_minor/)
  assert.match(migration, /invoice\.restaurant_id = operation\.restaurant_id/)
  assert.match(migration, /invoice\.subscription_id = operation\.subscription_id/)
})

test('checkout reconciliation resolver is not callable by browser roles', () => {
  assert.match(
    migration,
    /revoke all on function public\.resolve_subscription_checkout_reconciliation_after_finalize\(\)\s+from public, anon, authenticated/,
  )
})
