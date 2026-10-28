import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain'
import {
  readAnalyticsCoreMetrics,
  readDashboardCollectedOrders,
  readDashboardOrderVolume,
  readDashboardTableRefs,
  readDashboardTablePerformance,
  readOrdersBoard,
  readPanoBusiness,
  readPanoMetrics,
  readPanoOperationalSource,
  readPanoTableDetail,
  type DashboardInsightsReadModelPort,
} from './read-models'

const context = {
  actor: 'dashboard-member' as const,
  userId: 'member',
  restaurantId: 'restaurant-a',
  permissions: ['orders', 'tables'],
}

test('orders board rejects cross-tenant reads before invoking the repository', async () => {
  let invoked = false
  const result = await readOrdersBoard(
    context,
    { restaurantId: 'restaurant-b', since: '2026-07-15T00:00:00Z' },
    { async readBoard() { invoked = true; return ok({ orders: [], tables: [], hasKitchenAccess: false }) } },
  )
  assert.equal(result.ok, false)
  assert.equal(invoked, false)
})

test('orders board forwards a verified tenant read', async () => {
  const result = await readOrdersBoard(
    context,
    { restaurantId: 'restaurant-a', since: '2026-07-15T00:00:00Z' },
    { async readBoard() { return ok({ orders: [{ id: 'order' }], tables: [], hasKitchenAccess: false }) } },
  )
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.value.orders.length, 1)
})

test('pano table detail requires the tables section', async () => {
  const result = await readPanoTableDetail(
    { ...context, permissions: ['pano'] },
    { restaurantId: 'restaurant-a', tableId: 'table' },
    { async readTableDetail() { return ok({ sessionId: 'session', openedAt: '', orders: [] }) } },
  )
  assert.equal(result.ok, false)
})

const insightsPort: DashboardInsightsReadModelPort = {
  async readAnalyticsCoreMetrics() {
    return ok({
      currentOrders: 0, previousOrders: 0, currentSessions: 0, previousSessions: 0,
      currentRevenue: 0, previousRevenue: 0, currentPaidOrders: 0, previousPaidOrders: 0,
      sales: [], heatmap: [], products: [],
    })
  },
  async readOrderVolume() { return ok([]) },
  async readCollectedOrders() { return ok([]) },
  async readTableRefs() { return ok([]) },
  async readTablePerformance() {
    return ok({ tables: [], orders: [], closedSessions: [], openTableIds: [] })
  },
  async readPanoMetrics() {
    return ok({
      revenue: 0, revenueYesterday: 0, orders: 0, ordersYesterday: 0,
      paidOrders: 0, paidOrdersYesterday: 0, activeOrders: 0, pendingOrders: 0, preparingOrders: 0,
      sessions: 0, sessionsYesterday: 0, hourlySales: [], recentOrders: [],
      topItems: [], heatmap: [],
    })
  },
  async readPanoBusiness() {
    return err('not used')
  },
  async readPanoOperationalSource(input) {
    return ok({
      errors: [], tables: [], openTableSessions: [], pendingServiceRequests: [],
      paymentMode: null, paymentConfigured: input.includePaymentStatus,
    })
  },
}

test('dashboard insights reject cross-tenant and wrong-section reads', async () => {
  assert.equal((await readDashboardOrderVolume(
    context,
    { restaurantId: 'restaurant-b', section: 'analytics', since: '' },
    insightsPort,
  )).ok, false)
  assert.equal((await readDashboardCollectedOrders(
    { ...context, permissions: ['pano'] },
    { restaurantId: 'restaurant-a', section: 'analytics', since: '' },
    insightsPort,
  )).ok, false)
  assert.equal((await readDashboardTablePerformance(
    { ...context, permissions: ['pano'] },
    { restaurantId: 'restaurant-a', since: '' },
    insightsPort,
  )).ok, false)
  assert.equal((await readDashboardTableRefs(
    { ...context, permissions: ['pano'] },
    { restaurantId: 'restaurant-a', section: 'analytics' },
    insightsPort,
  )).ok, false)
})

test('analytics member forwards only the verified tenant and bounded time window', async () => {
  let received: Parameters<DashboardInsightsReadModelPort['readCollectedOrders']>[0] | null = null
  const result = await readDashboardCollectedOrders(
    { ...context, permissions: ['analytics'] },
    {
      restaurantId: 'restaurant-a',
      section: 'analytics',
      since: '2026-07-01T00:00:00Z',
      before: '2026-07-31T00:00:00Z',
      filters: { source: 'customer', paymentMethod: 'iyzico', status: 'served' },
    },
    {
      ...insightsPort,
      async readCollectedOrders(input) {
        received = input
        return ok([])
      },
    },
  )

  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    restaurantId: 'restaurant-a',
    since: '2026-07-01T00:00:00Z',
    before: '2026-07-31T00:00:00Z',
    filters: { source: 'customer', paymentMethod: 'iyzico', status: 'served' },
  })
})

test('analytics aggregate is tenant-gated and forwards only validated dimensions', async () => {
  let received: Parameters<DashboardInsightsReadModelPort['readAnalyticsCoreMetrics']>[0] | null = null
  const input = {
    restaurantId: 'restaurant-a',
    since: '2026-06-01T00:00:00Z',
    currentStart: '2026-07-01T00:00:00Z',
    before: '2026-08-01T00:00:00Z',
    timezone: 'Europe/Istanbul',
    filters: { source: 'customer' as const, paymentMethod: 'iyzico' as const, status: 'served' as const },
  }
  const result = await readAnalyticsCoreMetrics(
    { ...context, permissions: ['analytics'] },
    input,
    {
      ...insightsPort,
      async readAnalyticsCoreMetrics(value) {
        received = value
        return insightsPort.readAnalyticsCoreMetrics(value)
      },
    },
  )
  assert.equal(result.ok, true)
  assert.deepEqual(received, input)

  let foreignInvoked = false
  const denied = await readAnalyticsCoreMetrics(
    { ...context, permissions: ['analytics'] },
    { ...input, restaurantId: 'restaurant-b' },
    { ...insightsPort, async readAnalyticsCoreMetrics() { foreignInvoked = true; return insightsPort.readAnalyticsCoreMetrics(input) } },
  )
  assert.equal(denied.ok, false)
  assert.equal(foreignInvoked, false)
})

test('owner authority never bypasses the selected tenant boundary', async () => {
  let invoked = false
  const result = await readDashboardCollectedOrders(
    { ...context, isOwner: true, permissions: ['analytics'] },
    { restaurantId: 'restaurant-b', section: 'analytics', since: '' },
    {
      ...insightsPort,
      async readCollectedOrders() {
        invoked = true
        return ok([])
      },
    },
  )

  assert.equal(result.ok, false)
  assert.equal(invoked, false)
})

test('pano operational read never exposes owner-only payment status to members', async () => {
  let includePaymentStatus = true
  const result = await readPanoOperationalSource(
    { ...context, permissions: ['pano'], isOwner: false },
    { restaurantId: 'restaurant-a', includePaymentStatus: true },
    { ...insightsPort, async readPanoOperationalSource(input) {
      includePaymentStatus = input.includePaymentStatus
      return insightsPort.readPanoOperationalSource(input)
    } },
  )
  assert.equal(result.ok, true)
  assert.equal(includePaymentStatus, false)
})

test('pano aggregate metrics reject a cross-tenant service-role invocation', async () => {
  let invoked = false
  const result = await readPanoMetrics(
    { ...context, permissions: ['pano'] },
    {
      restaurantId: 'restaurant-b',
      todayStart: '',
      yesterdayStart: '',
      heatmapStart: '',
      timezone: 'Europe/Istanbul',
    },
    { ...insightsPort, async readPanoMetrics(input) {
      invoked = true
      return insightsPort.readPanoMetrics(input)
    } },
  )
  assert.equal(result.ok, false)
  assert.equal(invoked, false)
})

test('pano business figures need the analytics section', async () => {
  let invoked = false
  const port = { ...insightsPort, async readPanoBusiness() { invoked = true; return err('stop') } }
  const input = { restaurantId: context.restaurantId, now: '2026-10-30T12:00:00Z', timezone: 'Europe/Istanbul', periodDays: 7 as const }
  assert.equal((await readPanoBusiness({ ...context, permissions: ['pano', 'orders'] }, input, port)).ok, false)
  assert.equal(invoked, false)
  await readPanoBusiness({ ...context, permissions: ['pano', 'analytics'] }, input, port)
  assert.equal(invoked, true)
})
