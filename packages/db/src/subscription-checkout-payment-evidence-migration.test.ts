import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260901030000_subscription_checkout_payment_evidence.sql', import.meta.url),
  'utf8',
)

test('authenticated retrieve uses the common first-success-wins payment transition', () => {
  assert.match(migration, /'paymentEvidence', 'authenticated_retrieve'/)
  assert.match(migration, /insert into public\.billing_provider_events/)
  assert.match(migration, /'invoice\.payment_succeeded'/)
  assert.match(migration, /record_subscription_payment_success_atomic\(/)
  assert.match(migration, /v_payment_result->>'invoiceStatus' <> 'paid'/)
})

test('checkout success is rejected unless its exact invoice is fully paid', () => {
  assert.match(migration, /create function public\.assert_succeeded_checkout_has_paid_invoice/)
  assert.match(migration, /invoice\.status = 'paid'/)
  assert.match(migration, /invoice\.amount_paid_minor = invoice\.amount_due_minor/)
  assert.match(migration, /billing_checkout_payment_invariant_broken/)
  const paidTransition = migration.indexOf('record_subscription_payment_success_atomic(')
  const operationSuccess = migration.indexOf("set status = 'succeeded'", paidTransition)
  assert.ok(paidTransition >= 0 && operationSuccess > paidTransition)
})

test('add-ons follow paid invoices instead of provider operation state', () => {
  assert.match(migration, /drop trigger if exists activate_subscription_checkout_add_ons/)
  assert.match(migration, /create constraint trigger activate_paid_subscription_invoice_add_ons/)
  assert.match(migration, /new\.status <> 'paid'/)
  assert.match(migration, /deferrable initially deferred/)
  assert.doesNotMatch(
    migration.match(/create function public\.activate_paid_subscription_invoice_add_ons[\s\S]*?\n\$\$;/)?.[0] ?? '',
    /billing_provider_operations/,
  )
})

test('early webhooks converge after mapping and legacy open invoices are not promoted', () => {
  assert.match(migration, /event\.payload_sanitized->>'orderReferenceCode'/)
  assert.match(migration, /set status = 'resolved'/)
  assert.match(migration, /'checkout-unpaid:' \|\| operation\.id/)
  assert.match(migration, /'checkout_succeeded_invoice_unpaid'/)
  assert.doesNotMatch(migration, /update public\.subscription_invoices\s+set status = 'paid'[\s\S]*checkout_succeeded_invoice_unpaid/i)
})

test('financial transition RPC stays service-role-only', () => {
  assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/)
  assert.match(migration, /revoke all on function public\.finalize_subscription_checkout_operation[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.finalize_subscription_checkout_operation[\s\S]*to service_role/)
})
