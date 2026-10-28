import assert from 'node:assert/strict'
import test from 'node:test'
import type { PanoSnapshot } from '../../lib/queries/pano'
import { mergePanoRefresh, type PanoLiveSnapshot } from './pano-snapshot-model'

function snapshot(overrides: Partial<PanoSnapshot> = {}): PanoSnapshot {
  return {
    generatedAt: '2026-08-21T10:00:00.000Z', timezone: 'Europe/Istanbul', errors: [],
    kpis: { revenue: 100, revenueYesterday: 50, orders: 2, ordersYesterday: 1, paidOrders: 1, paidOrdersYesterday: 1, activeOrders: 1, avgBasket: 100, sessions: 1, sessionsYesterday: 1 },
    orderSummary: { pending: 1, preparing: 0 }, business: null,
    attentionItems: [{ id: 'orders:pending', kind: 'pending_order', severity: 'critical', title: 'Sipariş', detail: 'Yeni', createdAt: '2026-08-21T09:59:00.000Z' }],
    hourlySales: [{ hour: 10, total: 100 }],
    initialFeed: [{ id: 'order-1', status: 'pending', total: 100, tableId: null, tableLabel: null, createdAt: '2026-08-21T09:59:00.000Z' }],
    topItems: [{ name: 'Kahve', count: 1, revenue: 100 }], tableStatuses: [], heatmap: [],
    pendingServiceRequests: [], paymentStatus: null,
    health: { metrics: 'fresh', operational: 'fresh' },
    ...overrides,
  }
}

function live(value: PanoSnapshot): PanoLiveSnapshot {
  const { timezone: _timezone, initialFeed: _feed, tableStatuses: _tables, ...result } = value
  return result
}

test('failed metrics retain the last trustworthy KPI, chart and feed slices', () => {
  const current = snapshot()
  const incoming = snapshot({
    kpis: { ...current.kpis, revenue: 0 },
    initialFeed: [],
    health: { metrics: 'failed', operational: 'fresh' },
    errors: ['Pano metrikleri alınamadı'],
  })
  const result = mergePanoRefresh(live(current), current.initialFeed, current.tableStatuses, incoming)
  assert.equal(result.snapshot.kpis.revenue, 100)
  assert.equal(result.feed.length, 1)
  assert.equal(result.retainedData, true)
  assert.equal(result.fullyFresh, false)
  assert.deepEqual(result.snapshot.errors, incoming.errors)
})

test('degraded operational reads retain tables while accepting fresh metrics', () => {
  const current = snapshot({ tableStatuses: [{
    id: 'table-1', label: 'Masa 1', status: 'active', time: 10, total: 100,
    sessionId: 'session-1', openedAt: '2026-08-21T09:50:00.000Z', unpaidTotal: 100,
    splitSettledTotal: 0, splitDeclaredCashTotal: 0, orderCount: 1, hasUnfinished: true,
    isStaleSession: false,
  }] })
  const incoming = snapshot({
    kpis: { ...current.kpis, revenue: 200 }, tableStatuses: [],
    health: { metrics: 'fresh', operational: 'degraded' },
  })
  const result = mergePanoRefresh(live(current), current.initialFeed, current.tableStatuses, incoming)
  assert.equal(result.snapshot.kpis.revenue, 200)
  assert.equal(result.tableStatuses.length, 1)
  assert.equal(result.retainedData, true)
})

test('legacy rolling-deploy snapshots without health metadata remain refreshable', () => {
  const current = snapshot()
  const incoming = snapshot({ kpis: { ...current.kpis, revenue: 240 } })
  delete (incoming as Partial<PanoSnapshot>).health
  const result = mergePanoRefresh(live(current), current.initialFeed, current.tableStatuses, incoming)
  assert.equal(result.snapshot.kpis.revenue, 240)
  assert.equal(result.fullyFresh, true)
  assert.equal(result.retainedData, false)
})
