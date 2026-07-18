import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const clientSource = readFileSync(`${directory}/AnalyticsClient.tsx`, 'utf8')
const controllerSource = readFileSync(`${directory}/use-analytics-reports.ts`, 'utf8')
const modelSource = readFileSync(`${directory}/analytics-report-model.ts`, 'utf8')
const exportSource = readFileSync(`${directory}/analytics-report-export.ts`, 'utf8')
const shellSource = readFileSync(`${directory}/AnalyticsReportShell.tsx`, 'utf8')
const primitivesSource = readFileSync(`${directory}/AnalyticsReportPrimitives.tsx`, 'utf8')
const salesPaymentSource = readFileSync(`${directory}/AnalyticsSalesPaymentReports.tsx`, 'utf8')
const operationsSource = readFileSync(`${directory}/AnalyticsOperationsReport.tsx`, 'utf8')
const operationsModelSource = readFileSync(`${directory}/analytics-operations-model.ts`, 'utf8')
const itemsSource = readFileSync(`${directory}/AnalyticsItemsReport.tsx`, 'utf8')
const itemsModelSource = readFileSync(`${directory}/analytics-items-model.ts`, 'utf8')
const tablesSource = readFileSync(`${directory}/AnalyticsTablesReport.tsx`, 'utf8')
const tablesModelSource = readFileSync(`${directory}/analytics-tables-model.ts`, 'utf8')
const loyaltySource = readFileSync(`${directory}/AnalyticsLoyaltyReport.tsx`, 'utf8')
const loyaltyModelSource = readFileSync(`${directory}/analytics-loyalty-model.ts`, 'utf8')

test('analytics orchestrator delegates lazy report state and requests to its controller', () => {
  assert.match(clientSource, /useAnalyticsReports/)
  assert.doesNotMatch(clientSource, /useState|useTransition|fetchAnalyticsReportData/)
  assert.match(controllerSource, /fetchAnalyticsReportData/)
  assert.match(controllerSource, /latestRequestRef/)
  assert.doesNotMatch(controllerSource, /PageTopBar|<aside|<main/)
})

test('analytics loading, visibility and export readiness rules stay browser-safe', () => {
  assert.match(modelSource, /canExportAnalyticsReport/)
  assert.match(modelSource, /getVisibleAnalyticsReports/)
  assert.match(modelSource, /markAnalyticsReportLoaded/)
  assert.doesNotMatch(modelSource, /useState|useEffect|useTransition|lib\/actions\/analytics.*fetch|createClient|supabase/i)
})

test('analytics orchestrator delegates topbar, navigation and loading chrome', () => {
  assert.match(clientSource, /<AnalyticsReportShell/)
  assert.doesNotMatch(clientSource, /PageTopBar|<aside|Rapor türleri|Rapor yükleniyor/)
  assert.match(shellSource, /<PageTopBar/)
  assert.match(shellSource, /<aside/)
  assert.match(shellSource, /aria-label="Rapor türleri"/)
  assert.match(shellSource, /aria-pressed=/)
  assert.doesNotMatch(shellSource, /fetchAnalyticsReportData|createClient|supabase|restaurantId/i)
})

test('CSV serialization is separate from report rendering', () => {
  assert.match(clientSource, /buildAnalyticsReportCsv/)
  assert.doesNotMatch(clientSource, /function csvCell|function rowsToCsv|EXPORT_SLUGS/)
  assert.match(exportSource, /escapeAnalyticsCsvCell/)
  assert.match(exportSource, /Prevent|must not become formulas/)
})

test('sales and payment report families stay behind one infrastructure-free feature view', () => {
  assert.match(clientSource, /<AnalyticsSalesReport/)
  assert.match(clientSource, /<AnalyticsPaymentsReport/)
  assert.doesNotMatch(clientSource, /SalesLineChart|PaymentDonutChart|HeatmapGrid|function SalesReport|function PaymentsReport/)
  assert.match(salesPaymentSource, /export function AnalyticsSalesReport/)
  assert.match(salesPaymentSource, /export function AnalyticsPaymentsReport/)
  assert.match(salesPaymentSource, /paymentBreakdown\.collected/)
  assert.match(salesPaymentSource, /tahsilat dışı/)
  assert.doesNotMatch(salesPaymentSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('shared analytics presentation primitives stay tenant and data-source agnostic', () => {
  assert.doesNotMatch(clientSource, /AnalyticsCard|AnalyticsKpi|KPISmall|<Card/)
  assert.match(salesPaymentSource, /AnalyticsCard/)
  assert.match(salesPaymentSource, /AnalyticsKpi/)
  assert.match(operationsSource, /AnalyticsKpi as KPISmall/)
  assert.match(primitivesSource, /export function AnalyticsCard/)
  assert.match(primitivesSource, /export function AnalyticsKpi/)
  assert.doesNotMatch(primitivesSource, /lib\/actions|lib\/queries|createClient|supabase|restaurantId/i)
})

test('owner-only operation reports stay behind one infrastructure-free feature view', () => {
  assert.match(clientSource, /<AnalyticsOperationsReport/)
  assert.doesNotMatch(clientSource, /function OperationsReport|CancellationTrendChart|StaffSettlementTable|AbnormalCloseTable/)
  assert.match(operationsSource, /export function AnalyticsOperationsReport/)
  assert.match(operationsSource, /StaffSettlementTable/)
  assert.match(operationsSource, /AbnormalCloseTable/)
  assert.doesNotMatch(operationsSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('operation projection policy stays pure and independently testable', () => {
  assert.match(operationsModelSource, /projectOperationDelta/)
  assert.match(operationsModelSource, /compactCancellationTrend/)
  assert.match(operationsModelSource, /sumStaffMethod/)
  assert.doesNotMatch(operationsModelSource, /react|lib\/actions|createClient|supabase|restaurantId/i)
})

test('item performance reports stay behind one infrastructure-free feature view', () => {
  assert.match(clientSource, /<AnalyticsItemsReport/)
  assert.doesNotMatch(clientSource, /ProductScatterChart|function ItemsReport|ABCAnalysis|RisersList|FallersList/)
  assert.match(itemsSource, /export function AnalyticsItemsReport/)
  assert.match(itemsSource, /ProductScatterChart/)
  assert.match(itemsSource, /ABCAnalysis/)
  assert.doesNotMatch(itemsSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('item KPI and movement projection policy stays pure and independently testable', () => {
  assert.match(itemsModelSource, /projectProductReport/)
  assert.match(itemsModelSource, /selectProductMovers/)
  assert.match(itemsModelSource, /formatProductDelta/)
  assert.doesNotMatch(itemsModelSource, /react|lib\/actions|createClient|supabase|restaurantId/i)
})

test('table performance reports stay behind one infrastructure-free feature view', () => {
  assert.match(clientSource, /<AnalyticsTablesReport/)
  assert.doesNotMatch(clientSource, /function TablesReport|dwellLabel|Masa tahsilatı ve devri/)
  assert.match(tablesSource, /export function AnalyticsTablesReport/)
  assert.match(tablesSource, /projectTablesReport/)
  assert.match(tablesSource, /açık oturumlar sayılmaz/)
  assert.doesNotMatch(tablesSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('table KPI, ordering and dwell projection policy stays pure and independently testable', () => {
  assert.match(tablesModelSource, /projectTablesReport/)
  assert.match(tablesModelSource, /formatTableDwell/)
  assert.doesNotMatch(tablesModelSource, /occupancy|doluluk|react|lib\/actions|createClient|supabase|restaurantId/i)
})

test('loyalty reports stay behind one infrastructure-free feature view', () => {
  assert.match(clientSource, /<AnalyticsLoyaltyReport/)
  assert.doesNotMatch(clientSource, /function LoyaltyReportView|MiniStatRows|REDEEM_REASON_LABELS|tahsilat dışı/)
  assert.match(loyaltySource, /export function AnalyticsLoyaltyReport/)
  assert.match(loyaltySource, /projectLoyaltyReport/)
  assert.match(loyaltySource, /report\.compDelta/)
  assert.match(loyaltyModelSource, /tahsilat dışı/)
  assert.doesNotMatch(loyaltySource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('loyalty visibility, stat card and raw reason policy stays pure and independently testable', () => {
  assert.match(loyaltyModelSource, /projectLoyaltyReport/)
  assert.match(loyaltyModelSource, /resolveLoyaltyReasonLabel/)
  assert.match(loyaltyModelSource, /REDEMPTION_REASON_LABELS\[reason\] \?\? reason/)
  assert.doesNotMatch(loyaltyModelSource, /react|lib\/actions|createClient|supabase|restaurantId/i)
})

test('AnalyticsClient stays an orchestration-only shell', () => {
  const lineCount = clientSource.split('\n').length
  assert.ok(lineCount <= 130, `AnalyticsClient grew to ${lineCount} lines`)
  assert.doesNotMatch(clientSource, /function (Items|Tables|Loyalty|Operations|Sales|Payments)Report/)
})
