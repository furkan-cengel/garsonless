import assert from 'node:assert/strict'
import test from 'node:test'
import type { KitchenOrderPort, PublicOrderPort } from './orders'
import { placePublicOrder, settleOrder, transitionKitchenOrder } from './orders'

test('public order command rejects a mismatched verified table context before using the port', async () => {
  let touched = false
  const port: PublicOrderPort = {
    async resolveRestaurantIdBySlug() { touched = true; return 'restaurant' },
    async consumeRateLimit() { return { ok: true, value: true } },
    async createOrder() { throw new Error('unreachable') },
  }
  const result = await placePublicOrder(
    { actor: 'table-guest', restaurantId: 'restaurant', tableToken: 'table-a', sessionId: 'device-a' },
    { restaurantId: 'restaurant', slug: 'cafe', tableToken: 'table-b', tableId: 'internal-table', sessionId: 'device-a', requestId: 'request', lines: [], customerId: null, redeemPoints: 0, redeemStampClaim: false, catalogItemId: null, rateLimitKey: 'hash' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Invalid table context' })
  assert.equal(touched, false)
})

test('settlement keeps provider and dashboard payment methods separate', async () => {
  const port = { async settleOrder() { return { ok: true as const, value: null } } }
  const dashboard = await settleOrder(
    { actor: 'dashboard-member', restaurantId: 'restaurant', userId: 'staff', permissions: ['tables'] },
    { orderId: 'order', restaurantId: 'restaurant', method: 'iyzico' },
    port,
  )
  assert.deepEqual(dashboard, { ok: false, error: 'Online settlement is provider-only' })
})

test('kitchen cannot finish a multi-station order outside final inspection', async () => {
  let wrote = false
  const port: KitchenOrderPort = {
    async getOrder() { return { id: 'order', status: 'preparing', stationIds: ['bar', 'kitchen'] } },
    async updateStatus() { wrote = true; return { ok: true, value: null } },
  }
  const result = await transitionKitchenOrder(
    { actor: 'kitchen', restaurantId: 'restaurant', stationId: 'bar' },
    { orderId: 'order', restaurantId: 'restaurant', status: 'ready' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Çok istasyonlu siparişi Son Kontrol tamamlar' })
  assert.equal(wrote, false)
})
