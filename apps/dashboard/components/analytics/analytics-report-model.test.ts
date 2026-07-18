import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canExportAnalyticsReport,
  createInitialAnalyticsData,
  createInitialLoadedReports,
  createUnloadedReports,
  getVisibleAnalyticsReports,
  markAnalyticsReportLoaded,
  type AnalyticsInitialData,
} from './analytics-report-model'

const initialData: AnalyticsInitialData = {
  salesOverTime: [],
  heatmapData: [],
  tableStats: [],
  topItems: [],
  paymentBreakdown: { collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0 },
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

test('owner-only report visibility and export completeness fail closed', () => {
  assert.equal(getVisibleAnalyticsReports(false).some((report) => report.id === 'operasyon'), false)
  assert.equal(getVisibleAnalyticsReports(true).some((report) => report.id === 'operasyon'), true)

  const data = createInitialAnalyticsData(initialData)
  const loaded = { ...createUnloadedReports(), operasyon: true, sadakat: true }
  assert.equal(canExportAnalyticsReport('operasyon', loaded, data), false)
  assert.equal(canExportAnalyticsReport('sadakat', loaded, data), false)
})
