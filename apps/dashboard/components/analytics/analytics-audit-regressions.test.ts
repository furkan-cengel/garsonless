import { sumAnalyticsSalesBuckets } from '../../lib/analytics-sales-buckets'
import assert from 'node:assert/strict'
import test from 'node:test'
import { projectAnalyticsProducts } from '../../lib/analytics-product-projection'
import { projectProductReport, selectProductMovers } from './analytics-items-model'
import { analyticsReportUrl, readProductTableState } from './analytics-report-navigation'
import { analyticsDateError } from '../../lib/analytics-report-scope'
import { parseAnalyticsQuery } from '../../lib/analytics-filter-contract'

test('zero-current products remain in fallers without inflating current product count', () => {
  const rows = projectAnalyticsProducts([{ period: 'previous', name: 'Latte', revenue: 1000, count: 10 }])
  assert.equal(selectProductMovers(rows).fallers[0]?.deltaPct, -100)
  assert.equal(projectProductReport(rows).productCount, 0)
  assert.equal(projectProductReport(rows).totalRevenue, 0)
})

test('1500 equal products classify by unrounded kuruş and sum to 100 percent', () => {
  const rows = projectAnalyticsProducts(Array.from({ length: 1500 }, (_, i) => ({ period: 'current', name: String(i), revenue: 1, count: 1 })))
  assert.deepEqual(['A', 'B', 'C'].map((abc) => rows.filter((row) => row.abcClass === abc).length), [1200, 225, 75])
  assert.equal(rows.at(-1)?.cumulativePct, 100)
})

test('ABC exact boundaries, zero rows and tie ordering are deterministic', () => {
  const input = [80, 15, 5, 0].map((revenue, i) => ({ period: 'current', name: String(i), revenue, count: 1 }))
  assert.deepEqual(projectAnalyticsProducts(input).map((row) => row.abcClass), ['A', 'B', 'C', 'C'])
  const ties = ['b', 'a'].map((name) => ({ period: 'current', name, count: 1, revenue: 1 }))
  assert.deepEqual(projectAnalyticsProducts(ties), projectAnalyticsProducts([...ties].reverse()))
})

test('refresh preserves product URL state and filter commit resets page and detail', () => {
  const query = parseAnalyticsQuery({ range: 'month' })
  const url = analyticsReportUrl('/analytics', '?sort=name&dir=asc&page=4&detail=Latte', 'items', query)
  assert.match(url, /page=4/)
  assert.match(url, /detail=Latte/)
  const reset = analyticsReportUrl('/analytics', '?sort=name&dir=asc&page=4&detail=Latte', 'items', query, true)
  assert.match(reset, /sort=name/)
  assert.doesNotMatch(reset, /page=|detail=/)
  assert.deepEqual(readProductTableState('?page=8&sort=bad', 2), { page: 2, sort: 'revenue', direction: 'desc', detail: null })
  assert.equal(readProductTableState('', 2).page, 1)
})

test('future custom dates use restaurant day, including timezone midnight differences', () => {
  const query = parseAnalyticsQuery({ range: 'custom', from: '2026-09-07', to: '2026-09-07' })
  const now = new Date('2026-09-06T22:00:00Z')
  assert.equal(analyticsDateError(query, 'Europe/Istanbul', now), null)
  assert.match(analyticsDateError(query, 'America/New_York', now)!, /Gelecek/)
  const futureEnd = { ...query, to: '2026-09-08' }
  assert.match(analyticsDateError(futureEnd, 'Europe/Istanbul', now)!, /Gelecek/)
})


test('daily trend sums all hourly RPC buckets and retains period separation', () => {
  const rows = [0, 7, 22, 23].map((hour) => ({ period: 'current', day: '2026-09-05', hour, total: 300 }))
  rows.push({ period: 'previous', day: '2026-08-29', hour: 7, total: 1000 })
  assert.equal(sumAnalyticsSalesBuckets(rows, 'current', (row) => row.day).get('2026-09-05'), 1200)
  assert.equal(sumAnalyticsSalesBuckets(rows, 'previous', (row) => row.day).get('2026-08-29'), 1000)
  assert.equal(sumAnalyticsSalesBuckets(rows, 'current', (row) => row.hour).size, 4)
})
