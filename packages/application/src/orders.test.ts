import assert from 'node:assert/strict'
import test from 'node:test'
import type { DashboardOrderCreatePort, DashboardOrderLifecyclePort, KitchenOrderPort, PublicOrderPort } from './orders'
import {
  cancelDashboardOrder,
  createDashboardOrder,
  placePublicOrder,
  settleOrder,
  transitionDashboardOrder,
  transitionKitchenOrder,
} from './orders'

test('dashboard create derives the staff actor and rejects cross-tenant calls before the port', async () => {
  let write: Parameters<DashboardOrderCreatePort['createOrder']>[0] | null = null
  const port: DashboardOrderCreatePort = {
    async readOrderIngressStatus() { return 'active' },
    async createOrder(input) {
      write = input
      return { ok: true, value: { orderId: 'order' } }
    },
  }
  const denied = await createDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'staff', permissions: ['orders'] },
    { restaurantId: 'b', tableId: null, lines: [{ itemId: 'item', quantity: 1 }] },
    port,
  )
  assert.deepEqual(denied, { ok: false, error: 'Not authorized' })
  assert.equal(write, null)

  const created = await createDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'staff', permissions: ['orders'] },
    { restaurantId: 'a', tableId: 'table', lines: [{ itemId: 'item', quantity: 2 }] },
    port,
  )
  assert.deepEqual(created, { ok: true, value: { orderId: 'order' } })
  assert.deepEqual(write, {
    restaurantId: 'a',
    tableId: 'table',
    lines: [{ itemId: 'item', quantity: 2 }],
    createdBy: 'staff',
  })
})

test('public order command rejects a mismatched verified table context before using the port', async () => {
  let touched = false
  const port: PublicOrderPort = {
    async resolveRestaurantIdBySlug() { touched = true; return 'restaurant' },
    async readOrderIngressStatus() { return 'active' },
    async consumeRateLimit() { return { ok: true, value: true } },
    async createOrder() { throw new Error('unreachable') },
  }
  const result = await placePublicOrder(
    { actor: 'table-guest', restaurantId: 'restaurant', tableId: 'internal-table', tableToken: 'table-a', sessionId: 'device-a' },
    { restaurantId: 'restaurant', slug: 'cafe', tableToken: 'table-b', tableId: 'internal-table', sessionId: 'device-a', requestId: 'request', lines: [], customerId: null, redeemPoints: 0, redeemStampClaim: false, catalogItemId: null, rateLimitKey: 'hash' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Invalid table context' })
  assert.equal(touched, false)
})

test('public and dashboard order ingress fail closed for platform holds', async () => {
  let publicWrites = 0
  const publicPort: PublicOrderPort = {
    async resolveRestaurantIdBySlug() { return 'restaurant' },
    async readOrderIngressStatus() { return 'manual_hold' },
    async consumeRateLimit() { throw new Error('must not rate-limit a held tenant') },
    async createOrder() { publicWrites += 1; return { ok: true, value: { orderId: 'order', breakdown: {} } } },
  }
  const publicResult = await placePublicOrder(
    { actor: 'table-guest', restaurantId: 'restaurant', tableId: 'table', tableToken: 'token', sessionId: 'session' },
    { restaurantId: 'restaurant', slug: 'cafe', tableToken: 'token', tableId: 'table', sessionId: 'session', requestId: 'request', lines: [{ itemId: 'item', quantity: 1 }], customerId: null, redeemPoints: 0, redeemStampClaim: false, catalogItemId: null, rateLimitKey: 'hash' },
    publicPort,
  )
  assert.deepEqual(publicResult, { ok: false, error: 'İşletme şu anda yeni sipariş almıyor.' })
  assert.equal(publicWrites, 0)

  let dashboardWrites = 0
  const dashboardResult = await createDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'restaurant', userId: 'staff', permissions: ['orders'] },
    { restaurantId: 'restaurant', tableId: null, lines: [{ itemId: 'item', quantity: 1 }] },
    {
      async readOrderIngressStatus() { return 'suspended' },
      async createOrder() { dashboardWrites += 1; return { ok: true, value: { orderId: 'order' } } },
    },
  )
  assert.deepEqual(dashboardResult, { ok: false, error: 'İşletme şu anda yeni sipariş almıyor.' })
  assert.equal(dashboardWrites, 0)
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

test('kitchen derives station scope for the atomic write and retries are idempotent', async () => {
  let write: Parameters<KitchenOrderPort['updateStatus']>[0] | null = null
  const port: KitchenOrderPort = {
    async getOrder() { return { id: 'order', status: 'ready', stationIds: ['bar'] } },
    async updateStatus(input) { write = input; return { ok: true, value: null } },
  }
  const result = await transitionKitchenOrder(
    { actor: 'kitchen', restaurantId: 'restaurant', stationId: 'bar' },
    { orderId: 'order', restaurantId: 'restaurant', status: 'ready' },
    port,
  )
  assert.deepEqual(result, { ok: true, value: null })
  assert.deepEqual(write, {
    orderId: 'order',
    restaurantId: 'restaurant',
    stationId: 'bar',
    status: 'ready',
  })
})

function dashboardOrderPort(
  overrides: Partial<DashboardOrderLifecyclePort> = {},
): DashboardOrderLifecyclePort {
  return {
    async transitionStatus() { return { ok: true, value: null } },
    async readForCancellation() {
      return { ok: true, value: { status: 'served', paidAt: null, paymentMethod: null } }
    },
    async cancelOrder() { return { ok: true, value: null } },
    async cancelPaidManualOrder() { return { ok: true, value: null } },
    ...overrides,
  }
}

test('dashboard order lifecycle rejects cross-tenant and missing permission before ports', async () => {
  let touched = false
  const port = dashboardOrderPort({
    async transitionStatus() { touched = true; return { ok: true, value: null } },
  })
  const crossTenant = await transitionDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'staff', permissions: ['orders'] },
    { orderId: 'order', restaurantId: 'b', status: 'preparing' },
    port,
  )
  const missingPermission = await transitionDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'staff', permissions: ['tables'] },
    { orderId: 'order', restaurantId: 'a', status: 'preparing' },
    port,
  )
  assert.deepEqual(crossTenant, { ok: false, error: 'Not authorized' })
  assert.deepEqual(missingPermission, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

test('dashboard lifecycle fails closed when an untyped caller supplies payment or cancellation', async () => {
  let touched = false
  const port = dashboardOrderPort({
    async transitionStatus() { touched = true; return { ok: true, value: null } },
  })
  const context = { actor: 'dashboard-member' as const, restaurantId: 'a', userId: 'staff', permissions: ['orders'] }
  const paid = await transitionDashboardOrder(context, { orderId: 'order', restaurantId: 'a', status: 'paid' as never }, port)
  const cancelled = await transitionDashboardOrder(context, { orderId: 'order', restaurantId: 'a', status: 'cancelled' as never }, port)
  assert.deepEqual(paid, { ok: false, error: 'Use the dedicated cancellation or settlement command' })
  assert.deepEqual(cancelled, { ok: false, error: 'Use the dedicated cancellation or settlement command' })
  assert.equal(touched, false)
})

test('dashboard cancellation applies payment policy before the write port', async () => {
  let cancelled = false
  const online = await cancelDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'staff', permissions: ['orders'] },
    { orderId: 'order', restaurantId: 'a', reason: 'refund' },
    dashboardOrderPort({
      async readForCancellation() {
        return { ok: true, value: { status: 'served', paidAt: 'now', paymentMethod: 'iyzico' } }
      },
      async cancelOrder() { cancelled = true; return { ok: true, value: null } },
    }),
  )
  assert.deepEqual(online, { ok: false, error: 'Bu sipariş online ödendi — doğrulanmış İyzico iade akışını kullanın.' })
  assert.equal(cancelled, false)
})

test('dashboard cancellation derives actor audit and normalized reason', async () => {
  let write: Parameters<DashboardOrderLifecyclePort['cancelOrder']>[0] | null = null
  const result = await cancelDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'staff', permissions: ['orders'] },
    { orderId: 'order', restaurantId: 'a', reason: '  müşteri isteği  ' },
    dashboardOrderPort({
      async cancelOrder(input) { write = input; return { ok: true, value: null } },
    }),
  )
  assert.deepEqual(result, { ok: true, value: null })
  assert.deepEqual(write, {
    orderId: 'order',
    restaurantId: 'a',
    reason: 'müşteri isteği',
    cancelledBy: 'staff',
  })
})

test('paid cash/POS cancellation is owner-only and uses the atomic refund port', async () => {
  let write: Parameters<DashboardOrderLifecyclePort['cancelPaidManualOrder']>[0] | null = null
  const repository = dashboardOrderPort({
    async readForCancellation() {
      return { ok: true, value: { status: 'served', paidAt: 'now', paymentMethod: 'cash' } }
    },
    async cancelPaidManualOrder(input) { write = input; return { ok: true, value: null } },
  })
  const member = await cancelDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'staff', permissions: ['orders'] },
    { orderId: 'order', restaurantId: 'a', reason: 'Müşteri talebi' },
    repository,
  )
  assert.deepEqual(member, { ok: false, error: 'Paid cash/POS cancellation and refund is owner-only' })
  assert.equal(write, null)

  const owner = await cancelDashboardOrder(
    { actor: 'dashboard-member', restaurantId: 'a', userId: 'owner', permissions: ['orders'], isOwner: true },
    { orderId: 'order', restaurantId: 'a', reason: ' Müşteri talebi ' },
    repository,
  )
  assert.equal(owner.ok, true)
  assert.deepEqual(write, {
    orderId: 'order', restaurantId: 'a', reason: 'Müşteri talebi', cancelledBy: 'owner',
  })
})
