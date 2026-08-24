import assert from 'node:assert/strict'
import test from 'node:test'
import { projectCancellationAggregate } from '../../lib/analytics-cancellation-aggregate'

test('cancellation aggregate keeps financial classes and fills missing day buckets', () => {
  const result = projectCancellationAggregate({
    current: {
      allOrders: 20, cancelledCount: 2, lostAmount: 50,
      collectedCancelledCount: 1, collectedCancelledAmount: 80,
      compCancelledCount: 1, compCancelledAmount: 20,
    },
    previous: { allOrders: 10, cancelledCount: 1, lostAmount: 25 },
    topItems: [{ name: 'Americano', count: 2, revenue: 50 }],
    trend: [{ day: '2026-08-23', hour: 14, count: 2 }],
  }, 'Europe/Istanbul', new Date('2026-08-18T21:00:00Z'), new Date('2026-08-24T21:00:00Z'))

  assert.equal(result.rate, 10)
  assert.equal(result.deltaCount, 100)
  assert.equal(result.deltaLost, 100)
  assert.deepEqual(result.topItems, [{ name: 'Americano', count: 2, revenue: 50 }])
  assert.equal(result.trend.reduce((sum, row) => sum + row.count, 0), 2)
})
