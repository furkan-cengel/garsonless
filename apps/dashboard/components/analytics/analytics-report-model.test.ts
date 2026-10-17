import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canExportAnalyticsReport,
  createInitialAnalyticsData,
  createInitialLoadedReports,
  createUnloadedReports,
  getVisibleAnalyticsReports,
  markAnalyticsReportLoaded,
  type AnalyticsInitialData, unrecordedPaymentNotice } from './analytics-report-model'

const initialData: AnalyticsInitialData = {
  rangeKpis: {
    revenue: 0, previousRevenue: 0, orders: 0, previousOrders: 0,
    paidOrders: 0, previousPaidOrders: 0, avgBasket: 0, sessions: 0, previousSessions: 0,
  },
  salesOverTime: [],
  heatmapData: [],
  tableStats: [],
  topItems: [],
  paymentBreakdown: {
    collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0,
    financials: { grossSales: 0, discountTotal: 0, netSales: 0, vatTotal: 0, netOfVatTotal: 0, unknownVatGross: 0, unattributedAmount: 0 },
    refunds: { total: 0, count: 0, fullCount: 0, partialCount: 0, netCollected: 0, byMethod: [] },
    coverage: { monetaryRefunds: true, serviceFees: false, tips: false },
  },
  productReport: [],
}

test('initial analytics projection marks only server-hydrated reports as loaded', () => {
  const loaded = createInitialLoadedReports(initialData)
  assert.deepEqual(loaded, {
    sales: true,
    items: false,
    tables: false,
    payments: true,
    operasyon: false,
    sadakat: false,
  })
  assert.equal(createInitialAnalyticsData(initialData).loyalty, null)
})

test('range changes reset every report and sales refresh also hydrates payments', () => {
  const unloaded = createUnloadedReports()
  assert.equal(Object.values(unloaded).some(Boolean), false)
  const loaded = markAnalyticsReportLoaded(unloaded, 'sales')
  assert.equal(loaded.sales, true)
  assert.equal(loaded.payments, true)
})

test('owner-only and Pro report visibility plus export completeness fail closed', () => {
  assert.equal(getVisibleAnalyticsReports(false).some((report) => report.id === 'operasyon'), false)
  assert.equal(getVisibleAnalyticsReports(true).some((report) => report.id === 'operasyon'), true)
  assert.equal(getVisibleAnalyticsReports(true, false).some((report) => report.id === 'operasyon'), false)
  assert.equal(getVisibleAnalyticsReports(true, false).some((report) => report.id === 'sadakat'), false)
  assert.equal(getVisibleAnalyticsReports(true, true).some((report) => report.id === 'sadakat'), true)

  const data = createInitialAnalyticsData(initialData)
  const loaded = { ...createUnloadedReports(), operasyon: true, sadakat: true }
  assert.equal(canExportAnalyticsReport('operasyon', loaded, data), false)
  assert.equal(canExportAnalyticsReport('sadakat', loaded, data), false)
})

test('money reports explain orders whose payment was never recorded', () => {
  assert.equal(unrecordedPaymentNotice({ orders: 3, paidOrders: 3, revenue: 300 }), null)
  const none = unrecordedPaymentNotice({ orders: 4, paidOrders: 0, revenue: 0 })
  assert.equal(none?.tone, 'warning')
  assert.match(none?.title ?? '', /^4 sipariş var ama bu dönemde tahsilat kaydı yok/)
  const some = unrecordedPaymentNotice({ orders: 5, paidOrders: 3, revenue: 240 })
  assert.equal(some?.tone, 'info')
  assert.match(some?.title ?? '', /^2 sipariş bu dönemin tahsilatına yansımadı/)
})
