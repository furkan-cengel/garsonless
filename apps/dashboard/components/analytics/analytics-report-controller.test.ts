import assert from 'node:assert/strict'
import test from 'node:test'
import { AnalyticsReportController, type ReportControllerOptions } from './analytics-report-controller'
import { parseAnalyticsQuery } from '../../lib/analytics-filter-contract'
import type { AnalyticsReportResponse } from '../../lib/actions/analytics'

const scope = { timezone: 'Europe/Istanbul', currentStart: '2026-09-01T21:00:00Z', currentEnd: '2026-09-06T12:00:00Z', previousStart: '2026-08-27T21:00:00Z', previousEnd: '2026-09-01T21:00:00Z' }
const initialData = {
  liveActiveOrders: 2,
  rangeKpis: { revenue: 100, previousRevenue: 50, orders: 1, previousOrders: 1, paidOrders: 1, previousPaidOrders: 1, avgBasket: 100, sessions: 1, previousSessions: 1 },
  salesOverTime: [], heatmapData: [], topItems: [], tableStats: [], productReport: [],
  paymentBreakdown: {
    collected: [], collectedTotal: 100, collectedCount: 1, comp: { amount: 0, count: 0 },
    financials: { grossSales: 100, discountTotal: 0, netSales: 100, vatTotal: 0, netOfVatTotal: 100, unknownVatGross: 0, unattributedAmount: 0 },
    refunds: { total: 0, count: 0, fullCount: 0, partialCount: 0, netCollected: 100, byMethod: [] },
    coverage: { monetaryRefunds: true, serviceFees: false as const, tips: false as const },
  },
}
function setup() {
  const calls: Array<{ report: string; signal: AbortSignal; resolve: (response: AnalyticsReportResponse) => void }> = []
  const urls: string[] = []
  const options: ReportControllerOptions = {
    restaurantId: 'tenant-a', initialData, initialReport: 'sales', initialQuery: parseAnalyticsQuery({}), initialScope: scope,
    initialGeneratedAt: '2026-09-06T12:00:00Z', now: () => Date.parse('2026-09-06T12:00:00Z'), isOwner: true, hasAdvancedAnalytics: true,
    fetch: (_tenant, _query, report, signal) => new Promise((resolve) => calls.push({ report, signal, resolve })),
    navigate: (report, query) => { urls.push(`${report}:${query.range}`) },
  }
  return { controller: new AnalyticsReportController(options), calls, urls, options }
}
const answer = (data: AnalyticsReportResponse['data'], generatedAt = '2026-09-06T12:01:00Z'): AnalyticsReportResponse => ({ data, scope, generatedAt, snapshotVersion: Date.parse(generatedAt) })
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

test('payments refresh cannot partly overwrite the cached sales snapshot or its timestamp', async () => {
  const { controller, calls } = setup()
  controller.changeReport('payments')
  controller.refresh()
  calls[0]!.resolve(answer({ paymentBreakdown: { ...initialData.paymentBreakdown, collectedTotal: 200 } }))
  await flush()
  assert.equal(controller.getSnapshot().analyticsData.paymentBreakdown.collectedTotal, 200)
  controller.changeReport('sales')
  assert.equal(controller.getSnapshot().analyticsData.rangeKpis.revenue, 100)
  assert.equal(controller.getSnapshot().analyticsData.paymentBreakdown.collectedTotal, 100)
  assert.equal(controller.getSnapshot().generatedAt, '2026-09-06T12:00:00Z')
})

test('switching to a cached tab invalidates a late response and its history write', async () => {
  const { controller, calls, urls } = setup()
  controller.changeQuery(parseAnalyticsQuery({ range: 'month' }))
  controller.changeReport('payments')
  assert.equal(calls[0]!.signal.aborted, true)
  const history = [...urls]
  calls[0]!.resolve(answer({ ...initialData, rangeKpis: { ...initialData.rangeKpis, revenue: 999 } }))
  await flush()
  assert.equal(controller.getSnapshot().query.range, 'week')
  assert.equal(controller.getSnapshot().activeReport, 'payments')
  assert.equal(controller.getSnapshot().analyticsData.paymentBreakdown.collectedTotal, 100)
  assert.deepEqual(urls, history)
})

test('failed filter preserves coherent scope and retry commits it only on success', async () => {
  const { controller, calls } = setup()
  controller.changeQuery(parseAnalyticsQuery({ range: 'month' }))
  calls[0]!.resolve({ error: 'Bağlantı hatası', generatedAt: '', snapshotVersion: 0 })
  await flush()
  assert.equal(controller.getSnapshot().query.range, 'week')
  assert.equal(controller.getSnapshot().isPending, false)
  assert.equal(controller.getSnapshot().freshness, 'stale')
  assert.equal(controller.getSnapshot().canExport, true)
  controller.retry()
  calls[1]!.resolve(answer({ ...initialData, liveActiveOrders: 4 }))
  await flush()
  assert.equal(controller.getSnapshot().query.range, 'month')
  assert.equal(controller.getSnapshot().analyticsData.liveActiveOrders, 4)
  assert.equal(controller.getSnapshot().loadError, null)
})

test('invalidations during a request remain stale, and re-entry revalidates', async () => {
  const { controller, calls } = setup()
  controller.refresh()
  controller.markStale()
  calls[0]!.resolve(answer(initialData))
  await flush()
  assert.equal(controller.getSnapshot().freshness, 'stale')
  controller.changeReport('payments')
  assert.equal(calls.length, 2)
  assert.equal(controller.getSnapshot().isPending, true)
})

test('history and tenant changes never reuse another scope or restaurant data', async () => {
  const { controller, calls, options } = setup()
  controller.changeReport('items', parseAnalyticsQuery({ range: 'month' }), true)
  assert.equal(controller.getSnapshot().activeReportLoaded, false)
  assert.equal(controller.getSnapshot().canExport, false)
  controller.changeReport('sales', parseAnalyticsQuery({}), true)
  calls[0]!.resolve(answer({ productReport: [] }))
  await flush()
  assert.equal(controller.getSnapshot().activeReport, 'sales')
  const other = new AnalyticsReportController({ ...options, restaurantId: 'tenant-b', initialReport: 'items' })
  assert.equal(other.getSnapshot().activeReportLoaded, false)
})

test('incomplete payload is rejected and offline reconnect retries without losing data', async () => {
  const { controller, calls } = setup()
  controller.refresh()
  calls[0]!.resolve(answer({ paymentBreakdown: initialData.paymentBreakdown }))
  await flush()
  assert.match(controller.getSnapshot().loadError!, /eksik/)
  controller.setOffline(true)
  assert.equal(controller.getSnapshot().freshness, 'offline')
  controller.setOffline(false)
  calls[1]!.resolve(answer(initialData))
  await flush()
  assert.equal(controller.getSnapshot().freshness, 'fresh')
})


test('unrecognized prototype names from report URLs fall back to sales', () => {
  const { controller } = setup()
  controller.changeReport('constructor' as 'sales')
  assert.equal(controller.getSnapshot().activeReport, 'sales')
})
