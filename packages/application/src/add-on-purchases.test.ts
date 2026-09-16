import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AddOnInitializationRejected,
  startAddOnPurchase,
  reconcileAddOnPurchase,
  type AddOnPurchase,
  type AddOnPurchasePort,
  type AddOnPaymentProvider,
} from './add-on-purchases'
const purchase: AddOnPurchase = {
  id: 'purchase-1',
  restaurantId: 'restaurant-1',
  addOn: 'storefront_video_hero',
  status: 'pending',
  netAmountMinor: 39000,
  totalAmountMinor: 46800,
  vatRate: 20,
  currency: 'TRY',
  token: 'token',
  paymentPageUrl: 'https://cpp.iyzipay.com/test',
  returnContext: null,
  profile: {
    legalName: 'Test',
    name: 'Test',
    surname: 'Test',
    identityNumber: '11111111111',
    email: 'test@example.com',
    gsmNumber: '905350000000',
    billingAddress: {},
  },
}
const evidence = {
  token: 'token',
  paymentId: 'payment-1',
  basketId: 'purchase-1',
  conversationId: 'purchase-1',
  totalAmountMinor: 46800,
  currency: 'TRY',
  status: 'paid' as const,
  refundedAmountMinor: 0,
  chargeback: false,
}
function fixture(dispatchable = true) {
  const calls: string[] = []
  const port: AddOnPurchasePort = {
    prepare: async () => ({ purchase, dispatchable }),
    failInitialization: async () => {
      calls.push('fail')
    },
    attach: async () => {
      calls.push('attach')
    },
    read: async () => purchase,
    readByToken: async () => purchase,
    apply: async () => {
      calls.push('apply')
      return { ...purchase, status: 'paid' }
    },
  }
  const provider: AddOnPaymentProvider = {
    initialize: async () => {
      calls.push('initialize')
      return { token: 'new', paymentPageUrl: 'https://cpp.iyzipay.com/new' }
    },
    verifyUnpaidInitialization: async () => false,
    retrieve: async () => evidence,
  }
  return { calls, port, provider }
}
const input = {
  restaurantId: purchase.restaurantId,
  userId: 'owner',
  addOn: purchase.addOn,
  priceVersion: 1,
  requestId: 'request',
  returnContext: null,
}
test('replayed checkout never calls payment provider a second time', async () => {
  const f = fixture(false)
  assert.equal(
    (await startAddOnPurchase(input, f.port, f.provider)).id,
    purchase.id,
  )
  assert.deepEqual(f.calls, [])
})
test('new checkout attaches provider token before exposing redirect', async () => {
  const f = fixture()
  const result = await startAddOnPurchase(input, f.port, f.provider)
  assert.equal(result.token, 'new')
  assert.deepEqual(f.calls, ['initialize', 'attach'])
})
test('ambiguous provider timeout never dispatches an automatic retry', async () => {
  const f = fixture()
  f.provider.initialize = async () => {
    f.calls.push('initialize')
    throw new Error('timeout')
  }
  await assert.rejects(() => startAddOnPurchase(input, f.port, f.provider))
  assert.deepEqual(f.calls, ['initialize'])
})
test('paid evidence must match tenant purchase, amount, currency, and token', async () => {
  for (const patch of [
    { totalAmountMinor: 1 },
    { currency: 'USD' },
    { token: 'other' },
    { basketId: 'foreign' },
    { conversationId: 'foreign' },
    { paymentId: '' },
    { refundedAmountMinor: -1 },
  ]) {
    const f = fixture()
    f.provider.retrieve = async () => ({ ...evidence, ...patch })
    await assert.rejects(() =>
      reconcileAddOnPurchase(purchase, f.port, f.provider),
    )
    assert.deepEqual(f.calls, [])
  }
})
test('valid payment evidence crosses the atomic persistence boundary once', async () => {
  const f = fixture()
  await reconcileAddOnPurchase(purchase, f.port, f.provider)
  assert.deepEqual(f.calls, ['apply'])
})

test('definitive initialization rejection releases the reservation', async () => {
  const f = fixture()
  f.provider.initialize = async () => {
    throw new AddOnInitializationRejected('rejected')
  }
  await assert.rejects(() => startAddOnPurchase(input, f.port, f.provider))
  assert.deepEqual(f.calls, ['fail'])
})

test('ambiguous initialization is released only after a provider no-payment read', async () => {
  const f = fixture()
  const initializing = {
    ...purchase,
    token: null,
    paymentPageUrl: null,
    status: 'initializing' as const,
  }
  await reconcileAddOnPurchase(initializing, f.port, f.provider)
  assert.deepEqual(f.calls, [])
  f.provider.verifyUnpaidInitialization = async () => true
  f.port.read = async () => ({ ...initializing, status: 'failed' })
  assert.equal(
    (await reconcileAddOnPurchase(initializing, f.port, f.provider)).status,
    'failed',
  )
  assert.deepEqual(f.calls, ['fail'])
})
