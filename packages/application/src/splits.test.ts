import assert from 'node:assert/strict'
import test from 'node:test'
import type { SplitPaymentPort } from './splits'
import {
  confirmDashboardCashShare,
  declareSplitShare,
  prepareSplitCheckout,
  releaseSplitCheckout,
  settleProviderShare,
} from './splits'

function port(overrides: Partial<SplitPaymentPort> = {}): SplitPaymentPort {
  return {
    async readDeclarationSnapshot() { return { ok: true, value: { orders: [], settledTotal: 0 } } },
    async createDeclaredShare() { return { ok: true, value: { shareId: 'share' } } },
    async reserveOnlineCheckout() {
      return { ok: true, value: { amount: 50, restaurantSettings: null } }
    },
    async releaseOnlineCheckout() { return { ok: true, value: true } },
    async settleShare() { return { ok: true, value: { finalized: false, amount: 50, idempotent: false } } },
    ...overrides,
  }
}

test('split declaration is tenant-scoped, deduplicates item refs, and caps remaining amount', async () => {
  const created: Array<Parameters<SplitPaymentPort['createDeclaredShare']>[0]> = []
  const adapter = port({
    async readDeclarationSnapshot() {
      return {
        ok: true,
        value: {
          orders: [{ id: 'order', total: 30, items: [{ itemId: 'coffee', price: 20, quantity: 2, modifiersPriceDelta: 0 }] }],
          settledTotal: 5,
        },
      }
    },
    async createDeclaredShare(input) {
      created.push(input)
      return { ok: true, value: { shareId: 'share' } }
    },
  })
  const result = await declareSplitShare(
    { actor: 'table-guest', restaurantId: 'r', tableId: 't', tableToken: 'token' },
    {
      restaurantId: 'r', tableSessionId: 'session', method: 'cash', customerId: null,
      assignedItems: [{ orderId: 'order', itemId: 'coffee' }, { orderId: 'order', itemId: 'coffee' }],
    },
    adapter,
  )
  assert.deepEqual(result, { ok: true, value: { shareId: 'share', amount: 25 } })
  assert.equal(created[0]?.amount, 25)

  let touched = false
  const denied = await declareSplitShare(
    { actor: 'table-guest', restaurantId: 'r', tableId: 't', tableToken: 'token' },
    { restaurantId: 'other', tableSessionId: 'session', method: 'cash', customerId: null, amount: 10 },
    port({ async readDeclarationSnapshot() { touched = true; throw new Error('unreachable') } }),
  )
  assert.deepEqual(denied, { ok: false, error: 'Invalid table context' })
  assert.equal(touched, false)
})

test('checkout delegates amount reservation to the atomic port', async () => {
  const calls: unknown[] = []
  const result = await prepareSplitCheckout(
    { actor: 'table-guest', restaurantId: 'r', tableId: 't', tableToken: 'token' },
    { restaurantId: 'r', shareId: 'share' },
    port({
      async reserveOnlineCheckout(input) {
        calls.push(input)
        return { ok: true, value: { amount: 60, restaurantSettings: null } }
      },
    }),
  )
  assert.deepEqual(result, { ok: true, value: { amount: 60, restaurantSettings: null } })
  assert.deepEqual(calls, [{ restaurantId: 'r', tableId: 't', shareId: 'share' }])
})

test('cash and provider commands pass immutable settlement authority to the atomic port', async () => {
  const calls: Array<Parameters<SplitPaymentPort['settleShare']>[0]> = []
  const adapter = port({
    async settleShare(input) {
      calls.push(input)
      return { ok: true, value: { finalized: false, amount: 20, idempotent: false } }
    },
  })
  await confirmDashboardCashShare(
    { actor: 'dashboard-member', restaurantId: 'r', userId: 'staff', permissions: ['tables'] },
    { restaurantId: 'r', shareId: 'share' },
    adapter,
  )
  await settleProviderShare(
    { actor: 'payment-provider', restaurantId: 'r', provider: 'iyzico' },
    { restaurantId: 'r', shareId: 'share' },
    adapter,
  )
  assert.deepEqual(calls, [
    { restaurantId: 'r', shareId: 'share', settledBy: 'staff', expectedMethod: 'cash' },
    { restaurantId: 'r', shareId: 'share', settledBy: null, expectedMethod: 'iyzico' },
  ])
})

test('checkout release is tenant-scoped before touching the port', async () => {
  let released = false
  const denied = await releaseSplitCheckout(
    { actor: 'table-guest', restaurantId: 'r', tableId: 't', tableToken: 'token' },
    { restaurantId: 'other', shareId: 'share' },
    port({ async releaseOnlineCheckout() { released = true; return { ok: true, value: true } } }),
  )
  assert.deepEqual(denied, { ok: false, error: 'Invalid table context' })
  assert.equal(released, false)
})
