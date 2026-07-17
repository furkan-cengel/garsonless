import assert from 'node:assert/strict'
import test from 'node:test'
import type { OrderCheckoutPort } from './payments'
import { prepareOrderCheckout, releaseOrderCheckout } from './payments'

test('order checkout rejects cross-tenant context without reading infrastructure', async () => {
  let touched = false
  const port: OrderCheckoutPort = {
    async reserveOrderCheckout() {
      touched = true
      return { ok: true, value: { amount: 20, restaurantSettings: null, reservationId: 'lease' } }
    },
    async releaseOrderCheckout() { return { ok: true, value: true } },
  }
  const result = await prepareOrderCheckout(
    { actor: 'table-guest', restaurantId: 'r', tableId: 'table', tableToken: 'token' },
    { restaurantId: 'other', orderId: 'order' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Invalid table context' })
  assert.equal(touched, false)
})

test('order checkout returns the persisted rounded amount and settings', async () => {
  const result = await prepareOrderCheckout(
    { actor: 'table-guest', restaurantId: 'r', tableId: 'table', tableToken: 'token' },
    { restaurantId: 'r', orderId: 'order' },
    {
      async reserveOrderCheckout(input) {
        assert.equal(input.tableId, 'table')
        return { ok: true, value: { amount: 12.345, restaurantSettings: { city: 'İstanbul' }, reservationId: 'lease' } }
      },
      async releaseOrderCheckout() { return { ok: true, value: true } },
    },
  )
  assert.deepEqual(result, { ok: true, value: { amount: 12.35, restaurantSettings: { city: 'İstanbul' }, reservationId: 'lease' } })
})

test('order checkout release is tenant-scoped and forwards the lease', async () => {
  let released: unknown
  const port: OrderCheckoutPort = {
    async reserveOrderCheckout() { return { ok: false, error: 'unused' } },
    async releaseOrderCheckout(input) { released = input; return { ok: true, value: true } },
  }
  const context = { actor: 'table-guest' as const, restaurantId: 'r', tableId: 'table', tableToken: 'token' }
  assert.deepEqual(await releaseOrderCheckout(context, { restaurantId: 'other', orderId: 'o', reservationId: 'l' }, port), { ok: false, error: 'Invalid table context' })
  assert.equal(released, undefined)
  assert.deepEqual(await releaseOrderCheckout(context, { restaurantId: 'r', orderId: 'o', reservationId: 'l' }, port), { ok: true, value: true })
  assert.deepEqual(released, { restaurantId: 'r', orderId: 'o', reservationId: 'l' })
})
