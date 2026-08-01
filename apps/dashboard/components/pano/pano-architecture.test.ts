import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const clientSource = readFileSync(`${directory}/PanoClient.tsx`, 'utf8')
const widgetSource = readFileSync(`${directory}/PanoOverviewWidgets.tsx`, 'utf8')
const modelSource = readFileSync(`${directory}/pano-view-model.ts`, 'utf8')
const salesChartSource = readFileSync(`${directory}/PanoSalesChart.tsx`, 'utf8')
const chartControllerSource = readFileSync(`${directory}/use-pano-sales-chart.ts`, 'utf8')
const chartModelSource = readFileSync(`${directory}/../../lib/pano-chart-model.ts`, 'utf8')
const activityFeedSource = readFileSync(`${directory}/PanoActivityFeed.tsx`, 'utf8')
const liveStateSource = readFileSync(`${directory}/use-pano-live-state.ts`, 'utf8')
const approvalControllerSource = readFileSync(`${directory}/use-pano-order-approval.ts`, 'utf8')
const pageTopBarSource = readFileSync(`${directory}/../layout/PageTopBar.tsx`, 'utf8')
const attentionTablesSource = readFileSync(`${directory}/PanoAttentionTables.tsx`, 'utf8')
const stylesSource = readFileSync(`${directory}/PanoStyles.tsx`, 'utf8')
const iconRailSource = readFileSync(`${directory}/../layout/IconRail.tsx`, 'utf8')

test('PanoClient delegates attention, KPI, health and operational widgets', () => {
  assert.match(clientSource, /PanoAttentionQueue/)
  assert.match(clientSource, /PanoKpiCard/)
  assert.match(clientSource, /PanoTopItemsWidget/)
  assert.match(clientSource, /PanoPeakHours/)
  assert.match(clientSource, /PanoSystemHealth/)
  assert.match(clientSource, /PanoAttentionTables/)
  assert.doesNotMatch(clientSource, /PanoQuickActions|Hızlı işlemler|Menüye git|>Raporlar</)
  assert.doesNotMatch(clientSource, /TableStatusExperience/)
  assert.doesNotMatch(clientSource, /function (TopItemsWidget|PeakHours|QuickActions|SystemHealth|KPICard)/)
})

test('Pano table attention list delegates every account operation to canonical Canlı Masalar', () => {
  assert.match(attentionTablesSource, /tables\?tableId=/)
  assert.match(attentionTablesSource, /slice\(0, 5\)/)
  assert.doesNotMatch(attentionTablesSource, /fetchTableDetail|closeTableSession|SettlementSheet|TableTransferDialog|dynamic\(/)
  assert.doesNotMatch(attentionTablesSource, /lib\/actions|createClient|supabase/i)
})

test('Pano overview widgets remain tenant-agnostic presentation components', () => {
  assert.match(widgetSource, /export function PanoKpiCard/)
  assert.match(widgetSource, /export function PanoAttentionQueue/)
  assert.match(widgetSource, /export function PanoSystemHealth/)
  assert.doesNotMatch(widgetSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('Pano view model owns deterministic operational KPI and health projections', () => {
  assert.match(modelSource, /export function getPanoKpiCards/)
  assert.doesNotMatch(modelSource, /getPanoQuickActions|PanoQuickAction/)
  assert.match(modelSource, /export function getPanoHealthChecks/)
  assert.doesNotMatch(modelSource, /useState|useEffect|useTransition|lib\/actions|createClient|supabase|react/i)
})

test('Pano chart controller owns refreshes while its view owns SVG and tooltip semantics', () => {
  assert.match(clientSource, /PanoSalesChart/)
  assert.match(clientSource, /usePanoSalesChart/)
  assert.doesNotMatch(clientSource, /fetchPanoChart|function SalesChart|PANO_CHART_RANGES|useTransition/)

  assert.match(chartControllerSource, /fetchPanoChart/)
  assert.match(chartControllerSource, /requestSequence/)
  assert.doesNotMatch(chartControllerSource, /createClient|supabase/i)

  assert.match(salesChartSource, /export function PanoSalesChart/)
  assert.match(salesChartSource, /className="pano-chart-keyboard"/)
  assert.match(salesChartSource, /onKeyDown={onChartKeyDown}/)
  assert.match(salesChartSource, /Veriyi tablo olarak göster/)
  assert.doesNotMatch(salesChartSource, /tabIndex={0}[\s\S]{0,200}role="graphics-symbol"/)
  assert.match(salesChartSource, /role="tooltip"/)
  assert.match(salesChartSource, /aria-pressed/)
  assert.doesNotMatch(salesChartSource, /<title|<desc/)
  assert.doesNotMatch(salesChartSource, /lib\/actions|createClient|supabase|restaurantId/i)

  assert.match(chartModelSource, /export const PANO_CHART_RANGES/)
  assert.match(chartModelSource, /export function createDayPanoChart/)
  assert.match(chartModelSource, /export function navigatePanoChartIndex/)
  assert.doesNotMatch(chartModelSource, /useState|useEffect|lib\/actions|createClient|supabase|react/i)
})

test('Pano responsive shell exposes a two-row mobile header, 44px targets and reduced-motion support', () => {
  assert.match(clientSource, /className="page-topbar--pano"/)
  assert.match(clientSource, /<details className="pano-analytics" open>/)
  assert.match(widgetSource, /Yoğunluk verisini tablo olarak göster/)
  assert.match(widgetSource, /<table className="pano-data-table">/)
  assert.match(stylesSource, /grid-template-rows: 52px 52px/)
  assert.match(stylesSource, /min-height: 44px/)
  assert.match(stylesSource, /prefers-reduced-motion: reduce/)
  assert.match(iconRailSource, /width:44px;height:44px/)
})

test('Pano live state and order approval commands stay behind dedicated infrastructure controllers', () => {
  assert.match(clientSource, /PanoActivityFeed/)
  assert.match(clientSource, /usePanoLiveState/)
  assert.match(clientSource, /usePanoOrderApproval/)
  assert.doesNotMatch(clientSource, /createDashboardBrowserClient|fetchPanoSnapshot|fetchPanoTableStatuses|updateOrderStatus|function ActivityFeed/)

  assert.match(liveStateSource, /createDashboardBrowserClient/)
  assert.match(liveStateSource, /fetchPanoSnapshot/)
  assert.doesNotMatch(liveStateSource, /fetchPanoTableStatuses/)
  assert.equal(liveStateSource.match(/\.channel\(/g)?.length, 1)
  assert.match(liveStateSource, /channel\(`pano:\$\{restaurantId\}:/)
  assert.match(liveStateSource, /table: 'orders'/)
  assert.match(liveStateSource, /table: 'table_sessions'/)
  assert.match(liveStateSource, /table: 'payment_shares'/)
  assert.match(liveStateSource, /table: 'service_requests'/)
  assert.match(liveStateSource, /table: 'tables'/)
  assert.match(liveStateSource, /scheduleSnapshotRefresh/)
  assert.match(liveStateSource, /PANO_RECONCILE_INTERVAL_MS/)
  assert.match(liveStateSource, /visibilitychange/)
  assert.match(liveStateSource, /refreshInFlight/)

  assert.match(approvalControllerSource, /updateOrderStatus/)
  assert.match(approvalControllerSource, /pendingOrderIds/)
  assert.doesNotMatch(approvalControllerSource, /createClient|supabase/i)

  assert.match(activityFeedSource, /export function PanoActivityFeed/)
  assert.match(activityFeedSource, /aria-label=/)
  assert.doesNotMatch(activityFeedSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('PanoClient stays below the dashboard orchestration budget', () => {
  const lineCount = clientSource.split('\n').length
  assert.ok(lineCount <= 330, `PanoClient grew to ${lineCount} lines`)
})

test('Pano hydration starts from the server-generated clock', () => {
  assert.match(clientSource, /new Date\(props\.generatedAt\)/)
  assert.match(liveStateSource, /new Date\(initialSnapshot\.generatedAt\)/)
  assert.doesNotMatch(clientSource, /new Date\(\)\.toLocaleDateString/)
  assert.doesNotMatch(activityFeedSource, /Date\.now\(\)/)
  assert.match(activityFeedSource, /now\.getTime\(\)/)
  assert.match(pageTopBarSource, /suppressHydrationWarning/)
  assert.match(pageTopBarSource, /visibility: notificationCount > 0 \? 'visible' : 'hidden'/)
})
