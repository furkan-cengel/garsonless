import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/migrations/20260903020000_subscription_payment_identity_atomicity.sql', import.meta.url),
  'utf8',
)

const renewalRuntime = readFileSync(
  new URL('../scripts/verify-subscription-renewal-hydration-runtime.ts', import.meta.url),
  'utf8',
)
const addOnRuntime = readFileSync(
  new URL('../scripts/verify-subscription-add-on-lifecycle-runtime.ts', import.meta.url),
  'utf8',
)
const planChangeRuntime = readFileSync(
  new URL('../scripts/verify-subscription-plan-change-convergence-runtime.ts', import.meta.url),
  'utf8',
)

test('checkout recovery carries immutable amount, currency and interval expectations', () => {
  for (const field of ['expectedProviderPlanRef', 'expectedAmountMinor', 'expectedCurrency', 'expectedBillingInterval'])
    assert.match(sql, new RegExp(`'${field}'`))
  assert.match(sql, /amount_minor > 0 and currency = 'TRY'/)
  assert.match(sql, /billing_interval in \('monthly', 'annual'\)/)
})

test('checkout transition and paymentId binding share one rollback boundary', () => {
  const wrapper =
    sql.match(/create function public\.finalize_subscription_checkout_with_payment_identity[\s\S]*?\n\$\$;/)?.[0] ?? ''
  const transition = wrapper.indexOf('finalize_subscription_checkout_operation(')
  const binding = wrapper.indexOf('bind_subscription_payment_provider_id(')
  assert.ok(transition >= 0 && binding > transition)
  assert.match(wrapper, /v_operation\.amount_minor is distinct from p_amount_minor/)
  assert.match(wrapper, /case v_operation\.billing_interval[\s\S]*interval '1 month'[\s\S]*interval '1 year'/)
  assert.match(wrapper, /p_provider_order_status <> 'succeeded'/)
})

test('renewal transition cannot resolve without its successful paymentId', () => {
  const wrapper =
    sql.match(/create function public\.hydrate_subscription_invoice_with_payment_identity[\s\S]*?\n\$\$;/)?.[0] ?? ''
  const transition = wrapper.indexOf('hydrate_subscription_invoice_from_provider_event(')
  const binding = wrapper.indexOf('bind_subscription_payment_provider_id(')
  assert.ok(transition >= 0 && binding > transition)
  assert.match(wrapper, /p_provider_order_status = 'succeeded'[\s\S]*p_provider_payment_id/)
  assert.match(wrapper, /p_provider_order_status = 'failed' and p_provider_payment_id is not null/)
})

test('service role can call only atomic financial entrypoints after migration', () => {
  assert.match(sql, /revoke all on function public\.finalize_subscription_checkout_operation[\s\S]*from service_role/)
  assert.match(
    sql,
    /revoke all on function public\.hydrate_subscription_invoice_from_provider_event[\s\S]*from service_role/,
  )
  assert.match(
    sql,
    /grant execute on function public\.finalize_subscription_checkout_with_payment_identity[\s\S]*to service_role/,
  )
  assert.match(
    sql,
    /grant execute on function public\.hydrate_subscription_invoice_with_payment_identity[\s\S]*to service_role/,
  )
})

test('DEV renewal verifiers use the atomic hydration entrypoint with a payment identity', () => {
  for (const runtime of [renewalRuntime, addOnRuntime, planChangeRuntime]) {
    assert.doesNotMatch(runtime, /rpc\(["']hydrate_subscription_invoice_from_provider_event["']/)
    assert.match(runtime, /rpc\(["']hydrate_subscription_invoice_with_payment_identity["']/)
    assert.match(runtime, /p_provider_payment_id:/)
  }
})
