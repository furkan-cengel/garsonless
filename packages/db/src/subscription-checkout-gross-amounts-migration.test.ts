import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260831040000_subscription_checkout_gross_amounts.sql', import.meta.url),
  'utf8',
)
const diagnosticSql = readFileSync(
  new URL('../supabase/migrations/20260831041000_subscription_checkout_validation_codes.sql', import.meta.url),
  'utf8',
)

test('plan checkout accepts the same KDV-inclusive amounts provisioned at iyzico', () => {
  for (const [variant, grossAmount] of [
    ['starter:monthly', 41880], ['starter:annual', 402048],
    ['plus:monthly', 83880], ['plus:annual', 805248],
    ['pro:monthly', 143880], ['pro:annual', 1381248],
  ] as const) assert.match(sql, new RegExp(`when '${variant}' then ${grossAmount}`))

  assert.match(sql, /p_amount_minor <> v_expected_amount/)
  assert.match(sql, /KDV-inclusive provider amount/)
  assert.doesNotMatch(sql, /when 'plus:monthly' then 69900/)
})

test('gross checkout replacement preserves the service-role security boundary', () => {
  assert.match(sql, /create or replace function public\.prepare_subscription_checkout_operation/)
  assert.match(sql, /security definer/)
  assert.match(sql, /set search_path = public, pg_temp/)
})

test('checkout diagnostics separate only non-sensitive contract categories', () => {
  for (const category of ['plan', 'amount', 'period', 'idempotency', 'fingerprint']) {
    assert.match(diagnosticSql, new RegExp(`billing_checkout_${category}_invalid`))
  }
  assert.doesNotMatch(diagnosticSql, /p_contact_email[^\n]*raise|p_identity_number[^\n]*raise/)
})
