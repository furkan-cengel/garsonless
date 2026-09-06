import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAnalyticsReportCsv, escapeAnalyticsCsvCell } from './analytics-report-export'
import { createInitialAnalyticsData, type AnalyticsInitialData } from './analytics-report-model'

const initialData: AnalyticsInitialData = {
  rangeKpis: {
    revenue: 100, previousRevenue: 80, orders: 2, previousOrders: 1,
    paidOrders: 2, previousPaidOrders: 1, avgBasket: 50, sessions: 2, previousSessions: 1,
  },
  salesOverTime: [],
  heatmapData: [],
  tableStats: [],
  topItems: [{ name: '=HYPERLINK("https://invalid")', count: 1, revenue: 50 }],
  paymentBreakdown: {
    collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0,
    financials: { grossSales: 0, discountTotal: 0, netSales: 0, vatTotal: 0, netOfVatTotal: 0, unknownVatGross: 0, unattributedAmount: 0 },
    refunds: { total: 0, count: 0, fullCount: 0, partialCount: 0, netCollected: 0, byMethod: [] },
    coverage: { monetaryRefunds: true, serviceFees: false, tips: false },
  },
  productReport: [],
}

test('CSV cells neutralize ASCII, control-prefixed and full-width spreadsheet formulas', () => {
  const vectors: Array<[string, string]> = [
    ['=1+1', "'=1+1"],
    [' +1', "' +1"],
    ['\t-1', "'\t-1"],
    ['\r=1', '"\'\r=1"'],
    ['\n+1', '"\'\n+1"'],
    ['\tlabel', "'\tlabel"],
    [' \rlabel', '"\' \rlabel"'],
    ['＝1＋1', "'＝1＋1"],
    ['＋1', "'＋1"],
    ['－1', "'－1"],
    ['＠1', "'＠1"],
  ]
  for (const [input, expected] of vectors) {
    assert.equal(escapeAnalyticsCsvCell(input), expected)
  }
})

test('CSV cells quote structural characters and preserve UTF-8 text', () => {
  assert.equal(escapeAnalyticsCsvCell('a,b'), '"a,b"')
  assert.equal(escapeAnalyticsCsvCell('Türk, "Kahve"'), '"Türk, ""Kahve"""')
  assert.equal(escapeAnalyticsCsvCell('satır\nsonu'), '"satır\nsonu"')
  assert.equal(escapeAnalyticsCsvCell('noktalı;virgül'), '"noktalı;virgül"')
  assert.equal(escapeAnalyticsCsvCell(null), '')
})

test('sales CSV keeps the active report filename and neutralizes product names', () => {
  const result = buildAnalyticsReportCsv('sales', 'week', createInitialAnalyticsData(initialData))
  assert.ok(result)
  assert.equal(result.filename, 'satis-raporu-7gun.csv')
  assert.match(result.csv, /seçili dönem özeti \(Son 7 gün\)/)
  assert.match(result.csv, /Tahsil edilen \(₺\),100,80/)
  assert.doesNotMatch(result.csv, /günün özeti|Aktif sipariş/)
  assert.match(result.csv, /'=HYPERLINK/)
})

test('lazy reports cannot export before their complete payload exists', () => {
  const data = createInitialAnalyticsData(initialData)
  assert.equal(buildAnalyticsReportCsv('operasyon', 'month', data), null)
  assert.equal(buildAnalyticsReportCsv('sadakat', 'month', data), null)
})

test('CSV carries exact tenant, period, timezone and stale snapshot context', () => {
  const result = buildAnalyticsReportCsv('sales', 'week', createInitialAnalyticsData(initialData), {
    restaurantId: 'tenant-a', restaurantName: '=Şube A', generatedAt: '2026-09-06T12:00:00Z', freshness: 'stale',
    scope: { timezone: 'Europe/Istanbul', currentStart: '2026-08-30T21:00:00Z', currentEnd: '2026-09-06T12:00:00Z', previousStart: '2026-08-23T21:00:00Z', previousEnd: '2026-08-30T21:00:00Z' },
  })
  assert.ok(result)
  assert.match(result.csv, /Şube,'=Şube A/)
  assert.match(result.csv, /İşletme kimliği,tenant-a/)
  assert.match(result.csv, /Europe\/Istanbul/)
  assert.match(result.csv, /2026-08-30T21:00:00Z/)
  assert.match(result.csv, /2026-09-06T12:00:00Z/)
  assert.match(result.csv, /Son başarılı veri; güncel olmayabilir/)
})
