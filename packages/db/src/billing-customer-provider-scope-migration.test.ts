import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const scopeMigration = readFileSync(
  new URL('../supabase/migrations/20260902010000_billing_customer_provider_ref_tenant_scope.sql', import.meta.url),
  'utf8',
)
const checkoutMigration = readFileSync(
  new URL('../supabase/migrations/20260901030000_subscription_checkout_payment_evidence.sql', import.meta.url),
  'utf8',
)

test('provider payer references can be shared across restaurant-scoped customers', () => {
  assert.match(
    scopeMigration,
    /drop constraint if exists billing_customers_provider_provider_customer_ref_key/,
  )
  assert.match(
    scopeMigration,
    /create index if not exists billing_customers_provider_customer_ref_idx/,
  )
  assert.doesNotMatch(
    scopeMigration,
    /create unique index[\s\S]*provider_customer_ref/i,
  )
})

test('checkout still binds a provider payer reference only to its claimed tenant customer', () => {
  assert.match(
    checkoutMigration,
    /where id = v_operation\.billing_customer_id\s+and restaurant_id = v_operation\.restaurant_id/,
  )
  assert.match(
    checkoutMigration,
    /where restaurant_id = v_operation\.restaurant_id\s+and status <> 'cancelled'/,
  )
  assert.match(checkoutMigration, /billing_live_subscription_conflict/)
})
