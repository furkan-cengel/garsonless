import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const clientSource = readFileSync(`${directory}/AnalyticsClient.tsx`, 'utf8')
const storeSource = readFileSync(`${directory}/analytics-report-controller.ts`, 'utf8')
const exportHookSource = readFileSync(`${directory}/use-analytics-export.ts`, 'utf8')
const controllerSource = readFileSync(`${directory}/use-analytics-reports.ts`, 'utf8')
const reportClientSource = readFileSync(`${directory}/analytics-report-client.ts`, 'utf8')
const reportRouteSource = readFileSync(`${directory}/../../app/api/analytics/report/route.ts`, 'utf8')
const payloadBudgetSource = readFileSync(`${directory}/../../lib/analytics-payload-budget.ts`, 'utf8')
const modelSource = readFileSync(`${directory}/analytics-report-model.ts`, 'utf8')
const exportSource = readFileSync(`${directory}/analytics-report-export.ts`, 'utf8')
const shellSource = readFileSync(`${directory}/AnalyticsReportShell.tsx`, 'utf8')
const rangePickerSource = readFileSync(`${directory}/AnalyticsRangePicker.tsx`, 'utf8')
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
const chartLoaderSource = readFileSync(`${directory}/chart-primitives/load-analytics-chart.ts`, 'utf8')
const filterBarSource = readFileSync(`${directory}/AnalyticsFilterBar.tsx`, 'utf8')
const filterContractSource = readFileSync(`${directory}/../../lib/analytics-filter-contract.ts`, 'utf8')
const accessibleChartDataSource = readFileSync(`${directory}/chart-primitives/AccessibleChartData.tsx`, 'utf8')
const salesChartSource = readFileSync(`${directory}/chart-primitives/SalesLineChart.tsx`, 'utf8')
const paymentChartSource = readFileSync(`${directory}/chart-primitives/PaymentDonutChart.tsx`, 'utf8')
const productChartSource = readFileSync(`${directory}/chart-primitives/ProductScatterChart.tsx`, 'utf8')
const cancellationChartSource = readFileSync(`${directory}/chart-primitives/CancellationTrendChart.tsx`, 'utf8')
const heatmapSource = readFileSync(`${directory}/chart-primitives/HeatmapGrid.tsx`, 'utf8')
const globalStylesSource = readFileSync(`${directory}/../../app/globals.css`, 'utf8')
const dashboardQueriesPath = `${directory}/../../lib/queries.ts`
const analyticsQueriesSource = readFileSync(`${directory}/../../lib/queries/analytics.ts`, 'utf8')
const analyticsOperationsQueriesSource = readFileSync(`${directory}/../../lib/queries/analytics-operations.ts`, 'utf8')
const panoQueriesSource = readFileSync(`${directory}/../../lib/queries/pano.ts`, 'utf8')
const insightsSharedSource = readFileSync(`${directory}/../../lib/queries/insights-shared.ts`, 'utf8')
const restaurantsQueriesSource = readFileSync(`${directory}/../../lib/queries/restaurants.ts`, 'utf8')
const menuManagementQueriesSource = readFileSync(`${directory}/../../lib/queries/menu-management.ts`, 'utf8')
const themeEditorQueriesSource = readFileSync(`${directory}/../../lib/queries/theme-editor.ts`, 'utf8')
const tablesQueriesSource = readFileSync(`${directory}/../../lib/queries/tables.ts`, 'utf8')
const featureQueryContextSource = readFileSync(`${directory}/../../lib/queries/context.ts`, 'utf8')
const currentUserSource = readFileSync(`${directory}/../../lib/auth/current-user.ts`, 'utf8')
const settingsPageSource = readFileSync(`${directory}/../../app/dashboard/[restaurantId]/settings/page.tsx`, 'utf8')
const analyticsActionsSource = readFileSync(`${directory}/../../lib/actions/analytics.ts`, 'utf8')
const panoActionsSource = readFileSync(`${directory}/../../lib/actions/pano.ts`, 'utf8')
const applicationReadModelsSource = readFileSync(`${directory}/../../../../packages/application/src/read-models.ts`, 'utf8')
const dbReadModelsSource = readFileSync(`${directory}/../../../../packages/db/src/dashboard-read-model-port.ts`, 'utf8')
const dbFeatureReadModelsSource = readFileSync(`${directory}/../../../../packages/db/src/dashboard-feature-read-model-port.ts`, 'utf8')
const applicationRestaurantsSource = readFileSync(`${directory}/../../../../packages/application/src/restaurants.ts`, 'utf8')
const applicationMenuSource = readFileSync(`${directory}/../../../../packages/application/src/menu.ts`, 'utf8')
const applicationThemesSource = readFileSync(`${directory}/../../../../packages/application/src/themes.ts`, 'utf8')
const applicationTablesSource = readFileSync(`${directory}/../../../../packages/application/src/tables.ts`, 'utf8')
const applicationSettingsSource = readFileSync(`${directory}/../../../../packages/application/src/settings.ts`, 'utf8')
const applicationFeatureReadContractsSource = readFileSync(`${directory}/../../../../packages/application/src/dashboard-feature-read-models.ts`, 'utf8')
const dbReadModelContractSource = readFileSync(`${directory}/../../../../packages/db/src/dashboard-read-model-contract.ts`, 'utf8')
const dbReadModelObservabilitySource = readFileSync(`${directory}/../../../../packages/db/src/dashboard-read-model-observability.ts`, 'utf8')
const dbReadModelObservationSinkSource = readFileSync(`${directory}/../../../../packages/db/src/dashboard-read-model-observation-sink.ts`, 'utf8')
const dbReadModelHealthSource = readFileSync(`${directory}/../../../../packages/db/src/dashboard-read-model-health.ts`, 'utf8')
const dbReadModelHealthAlertSource = readFileSync(`${directory}/../../../../packages/db/src/dashboard-read-model-health-alert.ts`, 'utf8')
const dbReadModelHealthCheckSource = readFileSync(`${directory}/../../../../packages/db/scripts/check-dashboard-insights-health.ts`, 'utf8')
const dbReadModelHealthWorkflowSource = readFileSync(`${directory}/../../../../.github/workflows/dashboard-insights-health.yml`, 'utf8')

function readTypeScriptTree(root: string): string {
  return readdirSync(root).flatMap((entry) => {
    const path = `${root}/${entry}`
    if (statSync(path).isDirectory()) return readTypeScriptTree(path)
    return /\.tsx?$/.test(entry) ? [readFileSync(path, 'utf8')] : []
  }).join('\n')
}

const dashboardCallSiteSource = [
  readTypeScriptTree(`${directory}/../../app`),
  readTypeScriptTree(`${directory}/..`),
  readTypeScriptTree(`${directory}/../../lib/actions`),
].join('\n')

test('analytics orchestrator delegates lazy report state and requests to its controller', () => {
  assert.match(clientSource, /useAnalyticsReports/)
  assert.doesNotMatch(clientSource, /useState|useTransition|fetchAnalyticsReportData/)
  assert.match(controllerSource, /fetchAnalyticsReportPayload/)
  assert.match(controllerSource, /useSyncExternalStore/)
  assert.match(controllerSource, /window\.addEventListener\('online'/)
  assert.match(storeSource, /AbortController/)
  assert.match(storeSource, /sequence !== this\.sequence/)
  assert.match(storeSource, /this\.options\.fetch/)
  assert.match(storeSource, /Map<string, SnapshotEntry>/)
  assert.doesNotMatch(controllerSource, /PageTopBar|<aside|<main/)
})

test('analytics browser reads use a catchable same-origin no-store transport', () => {
  assert.match(reportClientSource, /fetch\('\/api\/analytics\/report'/)
  assert.match(reportClientSource, /credentials: 'same-origin'/)
  assert.match(reportClientSource, /cache: 'no-store'/)
  assert.doesNotMatch(reportClientSource, /createClient|supabase|service role/i)
  assert.doesNotMatch(controllerSource, /fetchAnalyticsReportData/)
})

test('analytics core is database-aggregated and HTTP payloads fail visibly above budget', () => {
  assert.match(insightsSharedSource, /readAnalyticsCoreMetrics/)
  assert.match(insightsSharedSource, /getAnalyticsCoreMetrics = cache/)
  assert.match(dbReadModelsSource, /\.rpc\('read_analytics_core_metrics'/)
  assert.match(reportRouteSource, /serializeAnalyticsResponse/)
  assert.match(reportRouteSource, /status: 413/)
  assert.match(payloadBudgetSource, /MAX_ANALYTICS_RESPONSE_BYTES = 1_500_000/)
})

test('lazy chart chunks wait for reconnect instead of rejecting the report route', () => {
  assert.match(chartLoaderSource, /navigator\.onLine/)
  assert.match(chartLoaderSource, /addEventListener\('online'/)
  assert.match(salesPaymentSource, /loadAnalyticsChart/)
  assert.match(itemsSource, /loadAnalyticsChart/)
  assert.match(operationsSource, /loadAnalyticsChart/)
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
  assert.match(shellSource, /<AnalyticsRangePicker/)
  assert.match(rangePickerSource, /aria-label="Rapor dönemi"/)
  assert.match(shellSource, /aria-busy=/)
  assert.doesNotMatch(shellSource, /fetchAnalyticsReportData|createClient|supabase|restaurantId/i)
})

test('analytics shell keeps mobile navigation, heading order and touch targets explicit', () => {
  assert.match(shellSource, /page-topbar--analytics/)
  assert.match(shellSource, /analytics-mobile-navigation/)
  assert.match(shellSource, /analytics-mobile-report-tabs/)
  assert.match(shellSource, /analytics-active-label/)
  assert.doesNotMatch(shellSource, /<h2/)
  assert.doesNotMatch(shellSource, /<main/)
  assert.match(shellSource, /<section className="analytics-main" aria-label=/)
  assert.match(globalStylesSource, /\.analytics-report-tab,[\s\S]{0,180}\.analytics-export-button \{[\s\S]{0,80}min-height: 36px/)
  assert.match(globalStylesSource, /@media \(pointer: coarse\)[\s\S]{0,520}\.analytics-report-tab,[\s\S]{0,520}min-height: 44px !important/)
  assert.match(globalStylesSource, /@media \(max-width: 1279px\)[\s\S]*\.analytics-report-tab--compact \{[\s\S]{0,220}min-height: 44px/)
  assert.match(globalStylesSource, /@media \(max-width: 1279px\)[\s\S]*\.analytics-sidebar \{ display: none/)
  assert.match(globalStylesSource, /@media \(max-width: 520px\)[\s\S]*\.analytics-filter-fields \{ grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(globalStylesSource, /\.analytics-responsive-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important/)
})

test('report controls use compact shadcn composition and retain chart hover feedback', () => {
  assert.match(shellSource, /<TabsTrigger[\s\S]*className="analytics-report-tab h-auto w-full flex-none justify-start px-2 py-2 text-left"/)
  assert.equal(shellSource.match(/aria-current=\{activeReport === report\.id \? 'page' : undefined\}/g)?.length, 2)
  assert.match(globalStylesSource, /\.analytics-desktop-report-tabs \.analytics-report-tab:not\(\[data-active\]\):hover \{[\s\S]{0,240}background: var\(--surface-3\);[\s\S]{0,100}transform: translateX\(2px\);/)
  assert.match(globalStylesSource, /\.analytics-desktop-report-tabs \.analytics-report-tab\[data-active\] \{[\s\S]{0,260}background: var\(--surface-inset\);[\s\S]{0,140}box-shadow: inset 3px 0 0 var\(--text\)/)
  assert.match(shellSource, /<Button[\s\S]*className="analytics-export-button"[\s\S]*size="sm"/)
  assert.match(filterBarSource, /<FieldGroup className="analytics-filter-fields"/)
  assert.match(filterBarSource, /<SelectTrigger[\s\S]*size="sm"/)
  assert.match(filterBarSource, /const selectedLabel = options\.find/)
  assert.doesNotMatch(filterBarSource, /min-w-32/)
  assert.match(rangePickerSource, /const selectedRangeLabel = ANALYTICS_RANGES\.find/)
  assert.match(globalStylesSource, /\.analytics-filter-fields \{[\s\S]{0,120}max-width: 520px;[\s\S]{0,100}flex: 0 1 520px;/)
  assert.match(globalStylesSource, /\.analytics-filter-fields \{[\s\S]{0,220}display: grid;[\s\S]{0,120}grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(paymentChartSource, /className="analytics-payment-legend-button"/)
  assert.match(globalStylesSource, /\.analytics-chart-data summary:hover/)
  assert.match(globalStylesSource, /\.analytics-payment-legend-button:not\(:disabled\):hover/)
})

test('custom range validation identifies and describes both date fields', () => {
  assert.match(rangePickerSource, /const DATE_ERROR_ID = 'analytics-custom-range-error'/)
  assert.equal(rangePickerSource.match(/aria-invalid=\{dateError \? true : undefined\}/g)?.length, 2)
  assert.equal(rangePickerSource.match(/aria-describedby=\{dateError \? DATE_ERROR_ID : undefined\}/g)?.length, 2)
  assert.match(rangePickerSource, /<FieldError id=\{DATE_ERROR_ID\}/)
  assert.match(rangePickerSource, /<Dialog open=\{open\}/)
})

test('analytics range and filters are allow-listed, shareable and server revalidated', () => {
  assert.match(filterContractSource, /'yesterday'/)
  assert.match(filterContractSource, /'calendar_month'/)
  assert.match(filterContractSource, /analyticsCustomDayCount/)
  assert.match(filterContractSource, /analyticsQueryToSearchParams/)
  assert.match(filterContractSource, /validateAnalyticsQuery/)
  assert.match(filterBarSource, /Filtreler birlikte uygulanır \(AND\)/)
  assert.match(filterBarSource, /Filtreleri temizle/)
  assert.match(controllerSource, /pushState/)
  assert.match(controllerSource, /popstate/)
  assert.match(storeSource, /start = \(\) => \{ this\.sync\(true\)/)
  assert.match(controllerSource, /parseAnalyticsQuery\(params\), true/)
  assert.match(analyticsActionsSource, /validateAnalyticsQuery/)
  assert.match(dbReadModelsSource, /filters\?\.source[\s\S]*\.eq\('source', filters\.source\)/)
  assert.match(dbReadModelsSource, /filters\?\.paymentMethod[\s\S]*\.eq\('payment_method', filters\.paymentMethod\)/)
  assert.match(dbReadModelsSource, /filters\?\.status[\s\S]*\.eq\('status', filters\.status\)/)
  assert.match(analyticsOperationsQueriesSource, /filters: \{ \.\.\.query\.filters, status: 'all' \}/)
})

test('analytics dialogs use the shared shadcn top-layer composition', () => {
  assert.match(rangePickerSource, /<DialogContent/)
  assert.match(rangePickerSource, /<DialogTitle>Özel tarih aralığı<\/DialogTitle>/)
  assert.match(itemsSource, /<Dialog open=\{selected !== null\}/)
  assert.match(itemsSource, /<DialogContent>/)
  assert.match(itemsSource, /<DialogTitle>\{selected\.name\}<\/DialogTitle>/)
})

test('analytics charts expose names, keyboard paths and same-data tables', () => {
  for (const source of [salesChartSource, paymentChartSource, productChartSource, cancellationChartSource]) {
    assert.match(source, /role="img"/)
    assert.match(source, /aria-label=/)
    assert.match(source, /accessibilityLayer/)
    assert.match(source, /AccessibleChartData/)
  }
  assert.match(accessibleChartDataSource, /<TableCaption/)
  assert.match(accessibleChartDataSource, /<TableHeader>/)
  assert.match(accessibleChartDataSource, /<TableBody>/)
  assert.match(accessibleChartDataSource, /Veri tablosunu göster/)
  assert.match(accessibleChartDataSource, /role="region"/)
  assert.match(heatmapSource, /role="grid"/)
  assert.match(heatmapSource, /role="gridcell"/)
  assert.match(heatmapSource, /tabIndex=/)
  assert.match(heatmapSource, /onKeyDown=/)
  assert.match(heatmapSource, /AccessibleChartData/)
  assert.match(heatmapSource, /analytics-heatmap-scroll/)
  assert.match(globalStylesSource, /\.analytics-heatmap-cell \{[\s\S]{0,120}min-width: 44px;[\s\S]{0,80}min-height: 44px;/)
  assert.match(globalStylesSource, /\.analytics-heatmap-scroll \{[\s\S]{0,120}overflow-x: auto;/)
})

test('analytics report motion follows the reduced-motion preference', () => {
  assert.doesNotMatch(shellSource, /transition: 'opacity 150ms'/)
  assert.match(globalStylesSource, /\.analytics-main \{[^}]*transition: opacity 150ms;/)
  assert.match(globalStylesSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,360}\.analytics-shell \*[\s\S]{0,220}transition-duration: 0s !important;/)
})

test('CSV serialization is separate from report rendering', () => {
  assert.match(exportHookSource, /buildAnalyticsReportCsv/)
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
  assert.match(salesPaymentSource, /rangeKpis\.revenue/)
  assert.match(salesPaymentSource, /analyticsPreviousPeriodLabel/)
  assert.match(salesPaymentSource, /seçili dönem KPI’larına dahil değildir/)
  assert.doesNotMatch(salesPaymentSource, /kpis\.revenueYesterday|kpis\.ordersYesterday/)
  assert.doesNotMatch(salesPaymentSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('sales range changes refresh KPI, chart, item and payment data from one as-of boundary', () => {
  assert.match(analyticsActionsSource, /const asOf = new Date\(\)/)
  assert.match(analyticsActionsSource, /getAnalyticsSalesReportData\(restaurantId, query, asOf\)/)
  assert.match(analyticsQueriesSource, /getAnalyticsCoreMetrics\(restaurantId, range, asOf\)/)
  assert.match(analyticsQueriesSource, /getAnalyticsRangeKPIs\(restaurantId, range, asOf, core\)/)
  assert.match(analyticsQueriesSource, /getSalesOverTime\(restaurantId, range, 'analytics', asOf, core\)/)
  assert.match(analyticsQueriesSource, /getTopItems\(restaurantId, range, asOf, core\)/)
  assert.match(analyticsQueriesSource, /getPaymentBreakdown\(restaurantId, range, asOf\)/)
  assert.match(storeSource, /data: \{ \.\.\.this\.baseline, \.\.\.response\.data \}/)
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
  assert.doesNotMatch(operationsSource, /row\.(sessionId|settledBy)/)
  assert.doesNotMatch(analyticsOperationsQueriesSource, /interface AbnormalCloseRow \{\s*sessionId:/)
  assert.doesNotMatch(analyticsOperationsQueriesSource, /interface StaffSettlementRow \{\s*settledBy:/)
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
  assert.match(itemsSource, /analytics-data-table-controls/)
  assert.match(itemsSource, /analytics-pagination/)
  assert.match(itemsSource, /<Table className="min-w-\[700px\]">/)
  assert.match(itemsSource, /<DialogContent>/)
  assert.match(itemsSource, /items\.find\(\(item\) => item\.name === state\.detail\) \?\? null/)
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
  assert.ok(lineCount <= 160, `AnalyticsClient grew to ${lineCount} lines`)
  assert.match(clientSource, /preloadAnalyticsReport/)
  assert.doesNotMatch(clientSource, /function (Items|Tables|Loyalty|Operations|Sales|Payments)Report/)
})

test('pano, analytics and orders reads stay behind application and database read-model ports', () => {
  const featureQueries = [
    analyticsQueriesSource,
    analyticsOperationsQueriesSource,
    panoQueriesSource,
    insightsSharedSource,
  ].join('\n')
  assert.doesNotMatch(featureQueries, /\.from\('(orders|table_sessions|payment_credentials)'\)/)
  assert.doesNotMatch(featureQueries, /applyCollectedOrderFilter|createServiceClient/)
  assert.match(analyticsQueriesSource, /readDashboardCollectedOrders/)
  assert.match(panoQueriesSource, /readPanoOperationalSource/)
  assert.match(applicationReadModelsSource, /allowInsightsRead/)
  assert.match(applicationReadModelsSource, /hasSameRestaurant/)
  assert.match(dbReadModelsSource, /applyCollectedOrderFilter/)
  assert.match(dbReadModelsSource, /createDashboardInsightsReadModelPort/)
})

test('dashboard insight projections and query health stay explicit at the DB boundary', () => {
  assert.match(dbReadModelsSource, /DASHBOARD_INSIGHTS_PROJECTIONS/)
  assert.match(dbReadModelsSource, /withDashboardInsightsObservability/)
  assert.match(dbReadModelContractSource, /orderVolume: 'id, total, status, session_id, table_id, created_at'/)
  assert.doesNotMatch(dbReadModelContractSource, /['"]\*['"]/)
  assert.match(dbReadModelObservabilitySource, /outcome: issues > 0 \? 'degraded' : 'success'/)
  assert.match(dbReadModelObservabilitySource, /Telemetry is deliberately best-effort/)
  assert.doesNotMatch(dbReadModelObservabilitySource, /createServiceClient|\.from\(/)
  assert.match(dbReadModelObservationSinkSource, /dashboard_query_observations/)
  assert.match(dbReadModelObservationSinkSource, /observation\.outcome !== 'success'/)
  assert.match(dbReadModelObservationSinkSource, /dashboard-insights-query-sink-failure/)
  assert.match(dbReadModelHealthSource, /get_dashboard_query_observation_health/)
  assert.match(dbReadModelHealthSource, /DEFAULT_DASHBOARD_INSIGHTS_HEALTH_THRESHOLDS/)
  assert.match(dbReadModelHealthSource, /15 \* 60 \* 1_000/)
  assert.doesNotMatch(dbReadModelHealthSource, /\.from\('dashboard_query_observations'\)/)
  assert.match(dbReadModelHealthAlertSource, /dashboard-insights\.health-alert/)
  assert.match(dbReadModelHealthAlertSource, /url\.protocol === 'https:'/)
  assert.doesNotMatch(dbReadModelHealthAlertSource, /restaurantId|restaurant_id/)
  assert.match(dbReadModelHealthCheckSource, /DASHBOARD_INSIGHTS_ALERT_WEBHOOK_URL/)
  assert.match(dbReadModelHealthCheckSource, /async function main\(\)/)
  assert.match(dbReadModelHealthCheckSource, /void main\(\)/)
  assert.match(dbReadModelHealthWorkflowSource, /cron: '\*\/15 \* \* \* \*'/)
  assert.match(dbReadModelHealthWorkflowSource, /DEV_SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(dbReadModelHealthWorkflowSource, /health:dashboard-insights/)
})

test('dashboard query compatibility facade stays retired and call-sites use feature boundaries', () => {
  assert.equal(existsSync(dashboardQueriesPath), false)
  assert.doesNotMatch(dashboardCallSiteSource, /from ['"][^'"]*lib\/queries['"]/)
  const facadeImport = /from ['"]\.\.\/queries(?:\.ts)?['"]/
  assert.doesNotMatch(analyticsQueriesSource, facadeImport)
  assert.doesNotMatch(analyticsOperationsQueriesSource, facadeImport)
  assert.doesNotMatch(panoQueriesSource, facadeImport)
  assert.match(analyticsActionsSource, /queries\/analytics/)
  assert.match(panoActionsSource, /queries\/pano/)
  assert.doesNotMatch(analyticsActionsSource, /from ['"]\.\.\/queries['"]/)
  assert.doesNotMatch(panoActionsSource, /from ['"]\.\.\/queries['"]/)

  const budgets = [
    ['analytics queries', analyticsQueriesSource, 450],
    ['analytics operations queries', analyticsOperationsQueriesSource, 390],
    ['pano queries', panoQueriesSource, 460],
    ['insights shared', insightsSharedSource, 180],
    ['restaurants queries', restaurantsQueriesSource, 90],
    ['menu management queries', menuManagementQueriesSource, 100],
    ['theme editor queries', themeEditorQueriesSource, 70],
    ['tables queries', tablesQueriesSource, 30],
  ] as const
  for (const [label, source, budget] of budgets) {
    const lineCount = source.split('\n').length
    assert.ok(lineCount <= budget, `${label} grew to ${lineCount} lines (budget ${budget})`)
  }
})

test('dashboard SSR feature reads cross actor-aware application and DB adapter boundaries', () => {
  for (const source of [
    restaurantsQueriesSource,
    menuManagementQueriesSource,
    themeEditorQueriesSource,
    tablesQueriesSource,
  ]) {
    // `Array.from()` is an in-memory helper, not a PostgREST table read. Only
    // reject the quoted table/RPC invocation form used by Supabase clients.
    assert.doesNotMatch(source, /createDashboardServerClient|createServiceClient|\.from\('[a-z_]+?'\)|\.rpc\('/)
    assert.match(source, /getDashboardFeatureContext|getDashboardUserContext/)
  }

  assert.match(featureQueryContextSource, /getDashboardAuthenticatedUser/)
  assert.match(featureQueryContextSource, /getUserRestaurantAccess/)
  assert.doesNotMatch(featureQueryContextSource, /\.from\(|createServiceClient/)
  assert.match(currentUserSource, /cache\(async function getDashboardRequestAuth/)
  assert.match(currentUserSource, /supabase\.auth\.getUser\(\)/)

  assert.match(restaurantsQueriesSource, /listDashboardRestaurants/)
  assert.match(restaurantsQueriesSource, /createDashboardRestaurantReadModelPort/)
  assert.match(menuManagementQueriesSource, /readMenuManagement/)
  assert.match(menuManagementQueriesSource, /createMenuManagementReadModelPort/)
  assert.match(themeEditorQueriesSource, /readThemeMenuReferences/)
  assert.match(themeEditorQueriesSource, /createThemeMenuReferenceReadModelPort/)
  assert.match(tablesQueriesSource, /readDashboardTables/)
  assert.match(tablesQueriesSource, /createDashboardTablesReadModelPort/)

  for (const source of [
    applicationRestaurantsSource,
    applicationMenuSource,
    applicationThemesSource,
    applicationTablesSource,
  ]) {
    assert.match(source, /authorizeDashboardFeatureRead/)
  }
  assert.match(applicationFeatureReadContractsSource, /DASHBOARD_FEATURE_READ_OPERATIONS/)
  assert.match(applicationFeatureReadContractsSource, /hasSameRestaurant\(context, restaurantId\)/)

  assert.match(dbFeatureReadModelsSource, /\.eq\('owner_id', userId\)/)
  assert.match(dbFeatureReadModelsSource, /\.eq\('user_id', userId\)/)
  assert.match(dbFeatureReadModelsSource, /\.eq\('restaurant_id', restaurantId\)/)
  assert.doesNotMatch(dbFeatureReadModelsSource, /auth\.getUser|permissions\.includes/)
})

test('dashboard query modules do not issue direct Supabase table reads', () => {
  for (const source of [
    insightsSharedSource,
    analyticsQueriesSource,
    analyticsOperationsQueriesSource,
    panoQueriesSource,
    restaurantsQueriesSource,
    menuManagementQueriesSource,
    themeEditorQueriesSource,
    tablesQueriesSource,
  ]) {
    assert.doesNotMatch(source, /createDashboardServerClient|createServiceClient|\.from\('[a-z_]+?'\)|\.rpc\('/)
  }
  assert.match(insightsSharedSource, /getRestaurantById\(restaurantId\)/)
})

test('settings SSR read crosses the same actor-aware application and DB adapter boundary', () => {
  assert.doesNotMatch(settingsPageSource, /createDashboardServerClient|\.from\(|listTeamMembers|getKitchenStationsForRestaurant/)
  assert.match(settingsPageSource, /getDashboardFeatureContext/)
  assert.match(settingsPageSource, /readDashboardSettings/)
  assert.match(settingsPageSource, /createDashboardSettingsReadModelPort/)
  assert.match(applicationSettingsSource, /authorizeDashboardFeatureRead\(context, restaurantId, 'settings\.snapshot'\)/)
  assert.match(applicationFeatureReadContractsSource, /'settings\.snapshot': \{ permissions: \['settings'\] \}/)
  assert.match(applicationSettingsSource, /includeOwnerData: context\.isOwner === true/)
})
