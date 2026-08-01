import assert from 'node:assert/strict'
import test from 'node:test'
import { projectAnalyticsRangeKpis } from '../../lib/analytics-range-kpis'

test('range KPIs split current and previous periods at the exact inclusive boundary', () => {
  const currentStart = new Date('2026-07-24T21:00:00.000Z')
  const result = projectAnalyticsRangeKpis([
    { status: 'paid', sessionId: 'previous-session', createdAt: '2026-07-24T20:59:59.999Z' },
    { status: 'paid', sessionId: 'current-session', createdAt: '2026-07-24T21:00:00.000Z' },
    { status: 'preparing', sessionId: 'current-session', createdAt: '2026-07-25T08:00:00.000Z' },
    { status: 'cancelled', sessionId: 'ignored', createdAt: '2026-07-25T09:00:00.000Z' },
  ], [
    { total: 80, paidAt: '2026-07-24T20:59:59.999Z' },
    { total: 100, paidAt: '2026-07-24T21:00:00.000Z' },
    { total: 50, paidAt: '2026-07-25T08:00:00.000Z' },
  ], currentStart)

  assert.deepEqual(result, {
    revenue: 150,
    previousRevenue: 80,
    orders: 2,
    previousOrders: 1,
    paidOrders: 2,
    previousPaidOrders: 1,
    avgBasket: 75,
    sessions: 1,
    previousSessions: 1,
  })
})

test('range KPI average is zero when the selected period has no collected order', () => {
  const result = projectAnalyticsRangeKpis([], [
    { total: 80, paidAt: '2026-07-24T20:59:59.999Z' },
  ], new Date('2026-07-24T21:00:00.000Z'))

  assert.equal(result.revenue, 0)
  assert.equal(result.avgBasket, 0)
  assert.equal(result.previousRevenue, 80)
})
