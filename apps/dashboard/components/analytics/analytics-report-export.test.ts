import assert from 'node:assert/strict'
import test from 'node:test'
import type { DashboardKPIs } from '../../lib/queries/analytics'
import { buildAnalyticsReportCsv, escapeAnalyticsCsvCell } from './analytics-report-export'
import { createInitialAnalyticsData, type AnalyticsInitialData } from './analytics-report-model'

const kpis: DashboardKPIs = {
  revenue: 100,
  revenueYesterday: 80,
  orders: 2,
  ordersYesterday: 1,
  paidOrders: 2,
  paidOrdersYesterday: 1,
  activeOrders: 0,
  avgBasket: 50,
  sessions: 2,
  sessionsYesterday: 1,
}

const initialData: AnalyticsInitialData = {
  salesOverTime: [],
  heatmapData: [],
  tableStats: [],
  topItems: [{ name: '=HYPERLINK("https://invalid")', count: 1, revenue: 50 }],
  paymentBreakdown: { collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0 },
  productReport: [],
}

test('CSV cells neutralize spreadsheet formulas and quote structural characters', () => {
  assert.equal(escapeAnalyticsCsvCell('=1+1'), "'=1+1")
  assert.equal(escapeAnalyticsCsvCell('a,b'), '"a,b"')
  assert.equal(escapeAnalyticsCsvCell(null), '')
})

test('sales CSV keeps the active report filename and neutralizes product names', () => {
  const result = buildAnalyticsReportCsv('sales', 'week', kpis, createInitialAnalyticsData(initialData))
  assert.ok(result)
  assert.equal(result.filename, 'satis-raporu-7gun.csv')
  assert.match(result.csv, /'=HYPERLINK/)
})

test('lazy reports cannot export before their complete payload exists', () => {
  const data = createInitialAnalyticsData(initialData)
  assert.equal(buildAnalyticsReportCsv('operasyon', 'month', kpis, data), null)
  assert.equal(buildAnalyticsReportCsv('sadakat', 'month', kpis, data), null)
})
