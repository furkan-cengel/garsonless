import assert from 'node:assert/strict'
import test from 'node:test'
import { ok } from '@garsonless/domain'
import {
  readDashboardCollectedOrders,
  readDashboardOrderVolume,
  readDashboardTableRefs,
  readDashboardTablePerformance,
  readOrdersBoard,
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
  async readOrderVolume() { return ok([]) },
  async readCollectedOrders() { return ok([]) },
  async readTableRefs() { return ok([]) },
  async readTablePerformance() {
    return ok({ tables: [], orders: [], closedSessions: [], openTableIds: [] })
  },
  async readPanoOperationalSource(input) {
    return ok({
      errors: [], tables: [], openSessions: [], openSessionOrders: [], sessionOpenings: [],
      activeOrderCount: 0, paymentMode: null, paymentConfigured: input.includePaymentStatus,
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

test('pano operational read never exposes owner-only payment status to members', async () => {
  let includePaymentStatus = true
  const result = await readPanoOperationalSource(
    { ...context, permissions: ['pano'], isOwner: false },
    { restaurantId: 'restaurant-a', sessionSince: '', includePaymentStatus: true },
    { ...insightsPort, async readPanoOperationalSource(input) {
      includePaymentStatus = input.includePaymentStatus
      return insightsPort.readPanoOperationalSource(input)
    } },
  )
  assert.equal(result.ok, true)
  assert.equal(includePaymentStatus, false)
})
