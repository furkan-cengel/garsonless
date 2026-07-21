import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  DashboardTablePort,
  KitchenBoardPort,
  KitchenOrderProjection,
  TableServiceRequestPort,
  TableSessionPort,
} from './tables'
import {
  closeTableSession,
  createDashboardTable,
  mergeKitchenOrderProjection,
  readKitchenOrders,
  rotateDashboardTableQrToken,
  requestTableService,
  resolveTableServiceRequest,
  saveDashboardQrStyle,
} from './tables'

const tableContext = {
  actor: 'dashboard-member' as const,
  restaurantId: 'restaurant-a',
  userId: 'staff',
  permissions: ['tables'],
}

function dashboardTablePort(overrides: Partial<DashboardTablePort> = {}): DashboardTablePort {
  return {
    async createTable() { return { ok: true, value: { kind: 'created', id: 'table-a', token: 'token-a' } } },
    async renameTable() { return { ok: true, value: null } },
    async deleteTable() { return { ok: true, value: 'deleted' } },
    async listQrTokens() { return { ok: true, value: {} } },
    async rotateQrToken() { return { ok: true, value: 'token-b' } },
    async readRestaurantSlug() { return { ok: true, value: 'cafe-a' } },
    async patchQrStyle() { return { ok: true, value: null } },
    ...overrides,
  }
}

test('dashboard table create rejects cross-tenant replay before touching persistence', async () => {
  let touched = false
  const result = await createDashboardTable(
    tableContext,
    { restaurantId: 'restaurant-b', label: 'Masa 1' },
    dashboardTablePort({
      async createTable() { touched = true; return { ok: true, value: { kind: 'created', id: 'table', token: 'token' } } },
    }),
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

test('dashboard table create preserves a typed plan-limit outcome for the HTTP adapter', async () => {
  const result = await createDashboardTable(
    tableContext,
    { restaurantId: 'restaurant-a', label: 'Masa 4' },
    dashboardTablePort({
      async createTable() { return { ok: true, value: { kind: 'plan_limit', limit: 3 } } },
    }),
  )
  assert.deepEqual(result, { ok: true, value: { kind: 'plan_limit', limit: 3 } })
})

test('dashboard QR rotation derives audit actor from trusted context', async () => {
  let revokedBy = ''
  const result = await rotateDashboardTableQrToken(
    tableContext,
    { restaurantId: 'restaurant-a', tableId: 'table-a' },
    dashboardTablePort({
      async rotateQrToken(input) {
        revokedBy = input.revokedBy
        return { ok: true, value: 'token-b' }
      },
    }),
  )
  assert.deepEqual(result, { ok: true, value: 'token-b' })
  assert.equal(revokedBy, 'staff')
})

test('QR style command rejects a forged base URL before persistence', async () => {
  let patched = false
  const result = await saveDashboardQrStyle(
    tableContext,
    {
      restaurantId: 'restaurant-a',
      style: { baseUrl: 'https://evil.example/cafe-a' },
      baseUrl: 'https://evil.example/cafe-a',
      menuOrigin: 'https://menu.masabu.co',
    },
    dashboardTablePort({
      async patchQrStyle() { patched = true; return { ok: true, value: null } },
    }),
  )
  assert.deepEqual(result, { ok: false, error: 'QR menu address cannot be changed' })
  assert.equal(patched, false)
})

test('table session close rejects cross-tenant replay before calling the port', async () => {
  let touched = false
  const port: TableSessionPort = {
    async closeSession() { touched = true; return { ok: true, value: 'closed_normal' } },
    async listOpenSessions() { return { ok: true, value: [] } },
  }
  const result = await closeTableSession(
    tableContext,
    { sessionId: 'session', restaurantId: 'restaurant-b' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

test('table session close exposes payment-pending as a typed fail-closed outcome', async () => {
  const port: TableSessionPort = {
    async closeSession() { return { ok: true, value: 'payment_pending' } },
    async listOpenSessions() { return { ok: true, value: [] } },
  }
  const result = await closeTableSession(
    tableContext,
    { sessionId: 'session', restaurantId: 'restaurant-a', abnormalReason: 'walkout' },
    port,
  )
  assert.deepEqual(result, { ok: true, value: 'payment_pending' })
})

test('public service request binds restaurant, internal table and opaque token', async () => {
  let touched = false
  const port: TableServiceRequestPort = {
    async createRequest() { touched = true; return { ok: true, value: { throttled: false } } },
    async resolveRequest() { return { ok: true, value: null } },
    async listPendingRequests() { return { ok: true, value: [] } },
  }
  const result = await requestTableService(
    { actor: 'table-guest', restaurantId: 'restaurant-a', tableId: 'table-a', tableToken: 'token-a' },
    { restaurantId: 'restaurant-a', tableId: 'table-b', tableToken: 'token-a', requestType: 'water' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Invalid table context' })
  assert.equal(touched, false)
})

test('service request resolution requires tables permission', async () => {
  let touched = false
  const port: TableServiceRequestPort = {
    async createRequest() { return { ok: true, value: { throttled: false } } },
    async resolveRequest() { touched = true; return { ok: true, value: null } },
    async listPendingRequests() { return { ok: true, value: [] } },
  }
  const result = await resolveTableServiceRequest(
    { ...tableContext, permissions: ['orders'] },
    { requestId: 'request', restaurantId: 'restaurant-a' },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})

const kitchenOrder = (input: Partial<KitchenOrderProjection> = {}): KitchenOrderProjection => ({
  id: 'order-a',
  status: 'preparing',
  table_id: 'table-a',
  items: [],
  customer_tier: null,
  paid_at: null,
  created_at: '2026-07-17T08:00:00.000Z',
  updated_at: '2026-07-17T08:00:00.000Z',
  active: true,
  ...input,
})

test('kitchen projection delta upserts active rows and removes tombstones', () => {
  const current = [kitchenOrder(), kitchenOrder({ id: 'order-b' })]
  const merged = mergeKitchenOrderProjection(current, {
    cursor: '2026-07-17T08:01:00.000Z',
    snapshot: false,
    orders: [
      kitchenOrder({ id: 'order-a', status: 'ready', updated_at: '2026-07-17T08:01:00.000Z' }),
      kitchenOrder({ id: 'order-b', status: 'served', active: false }),
      kitchenOrder({ id: 'order-c' }),
    ],
  })
  assert.deepEqual(merged.map((order) => [order.id, order.status]), [
    ['order-a', 'ready'],
    ['order-c', 'preparing'],
  ])
})

test('kitchen projection snapshot drops stale and inactive rows', () => {
  const merged = mergeKitchenOrderProjection([kitchenOrder({ id: 'stale' })], {
    cursor: '2026-07-17T08:01:00.000Z',
    snapshot: true,
    orders: [kitchenOrder({ id: 'fresh' }), kitchenOrder({ id: 'terminal', active: false })],
  })
  assert.deepEqual(merged.map((order) => order.id), ['fresh'])
})

test('kitchen projection rejects cross-tenant polling before touching the port', async () => {
  let touched = false
  const port: KitchenBoardPort = {
    async readBoard() { throw new Error('not used') },
    async readOrders() {
      touched = true
      return { ok: true, value: { cursor: '', snapshot: false, orders: [] } }
    },
  }
  const result = await readKitchenOrders(
    { actor: 'kitchen', restaurantId: 'restaurant-a', stationId: 'expo' },
    { restaurantId: 'restaurant-b', after: null },
    port,
  )
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(touched, false)
})
