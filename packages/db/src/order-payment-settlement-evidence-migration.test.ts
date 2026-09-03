import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260903051000_order_payment_settlement_evidence.sql', import.meta.url),
  'utf8',
)
const callback = readFileSync(
  new URL('../../../apps/menu/app/api/payment/callback/route.ts', import.meta.url),
  'utf8',
)

test('order provider evidence must match the reserved and current order totals', () => {
  assert.match(migration, /create or replace function public\.attach_order_provider_payment/)
  assert.match(migration, /v_order\.checkout_amount is null/)
  assert.match(migration, /checkout_amount::numeric, 2\) <> round\(v_order\.total::numeric, 2\)/)
  assert.match(migration, /checkout_amount::numeric, 2\) <> round\(p_paid_price, 2\)/)
  assert.match(migration, /p_currency <> 'TRY'/)
  assert.match(migration, /for update of opt, o/)
})

test('exact provider evidence replay is accepted but drift and public access fail closed', () => {
  assert.match(migration, /if v_token\.provider_payment_id is not null[\s\S]*return true/)
  assert.match(migration, /provider_payment_mapping_conflict/)
  assert.match(migration, /revoke all on function public\.attach_order_provider_payment\([\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.attach_order_provider_payment\([\s\S]*to service_role/)
})

test('order callback rejects provider basket drift before attaching or settling', () => {
  const mismatch = callback.indexOf('if (basketId !== orderId)')
  assert.ok(mismatch > callback.indexOf('if (!orderId || !restaurantId)'))
  assert.ok(mismatch < callback.indexOf('attachOrderProviderPayment({'))
  assert.match(callback, /stage: 'provider_basket_mismatch'/)
})
