import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAnalyticsCoreMetrics } from './dashboard-read-model-port'

function validPayload() {
  return {
    currentOrders: 3,
    previousOrders: 2,
    currentSessions: 2,
    previousSessions: 1,
    currentRevenue: 125.5,
    previousRevenue: 80,
    currentPaidOrders: 2,
    previousPaidOrders: 1,
    productOverflow: false,
    sales: [{ period: 'current', day: '2026-07-31', hour: 14, total: 125.5 }],
    heatmap: [{ day: 3, hour: 14, count: 3 }],
    products: [{ period: 'current', name: 'Türk Kahvesi', count: 2, revenue: 75 }],
  }
}

test('analytics aggregate parser accepts the complete bounded RPC contract', () => {
  assert.deepEqual(parseAnalyticsCoreMetrics(validPayload()), {
    currentOrders: 3,
    previousOrders: 2,
    currentSessions: 2,
    previousSessions: 1,
    currentRevenue: 125.5,
    previousRevenue: 80,
    currentPaidOrders: 2,
    previousPaidOrders: 1,
    sales: [{ period: 'current', day: '2026-07-31', hour: 14, total: 125.5 }],
    heatmap: [{ day: 3, hour: 14, count: 3 }],
    products: [{ period: 'current', name: 'Türk Kahvesi', count: 2, revenue: 75 }],
  })
})

test('analytics aggregate parser rejects missing, coerced and impossible values', () => {
  const cases: unknown[] = [
    { ...validPayload(), sales: undefined },
    { ...validPayload(), currentRevenue: '125.5' },
    { ...validPayload(), currentRevenue: -1 },
    { ...validPayload(), currentRevenue: Number.NaN },
    { ...validPayload(), productOverflow: undefined },
    { ...validPayload(), products: {} },
    { ...validPayload(), sales: [{ period: 'current', day: '2026-07-31', hour: 99, total: 1 }] },
    { ...validPayload(), heatmap: [{ day: 7, hour: 14, count: 1 }] },
    { ...validPayload(), products: [{ period: 'current', name: '', count: 1, revenue: 1 }] },
  ]

  for (const value of cases) assert.equal(parseAnalyticsCoreMetrics(value), null)
})
