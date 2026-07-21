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

test('PanoClient delegates KPI, health, quick-action and operational widgets', () => {
  assert.match(clientSource, /PanoKpiCard/)
  assert.match(clientSource, /PanoTopItemsWidget/)
  assert.match(clientSource, /PanoPeakHours/)
  assert.match(clientSource, /PanoQuickActions/)
  assert.match(clientSource, /PanoSystemHealth/)
  assert.doesNotMatch(clientSource, /function (TopItemsWidget|PeakHours|QuickActions|SystemHealth|KPICard)/)
})

test('Pano overview widgets remain tenant-agnostic presentation components', () => {
  assert.match(widgetSource, /export function PanoKpiCard/)
  assert.match(widgetSource, /export function PanoQuickActions/)
  assert.match(widgetSource, /export function PanoSystemHealth/)
  assert.doesNotMatch(widgetSource, /lib\/actions|createClient|supabase|restaurantId/i)
})

test('Pano view model owns deterministic permission, KPI and health projections', () => {
  assert.match(modelSource, /export function getPanoKpiCards/)
  assert.match(modelSource, /export function getPanoQuickActions/)
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
  assert.match(salesChartSource, /role="graphics-symbol"/)
  assert.match(salesChartSource, /role="tooltip"/)
  assert.match(salesChartSource, /aria-pressed/)
  assert.doesNotMatch(salesChartSource, /lib\/actions|createClient|supabase|restaurantId/i)

  assert.match(chartModelSource, /export const PANO_CHART_RANGES/)
  assert.match(chartModelSource, /export function createDayPanoChart/)
  assert.doesNotMatch(chartModelSource, /useState|useEffect|lib\/actions|createClient|supabase|react/i)
})

test('Pano live state and order approval commands stay behind dedicated infrastructure controllers', () => {
  assert.match(clientSource, /PanoActivityFeed/)
  assert.match(clientSource, /usePanoLiveState/)
  assert.match(clientSource, /usePanoOrderApproval/)
  assert.doesNotMatch(clientSource, /createDashboardBrowserClient|fetchPanoSnapshot|fetchPanoTableStatuses|updateOrderStatus|function ActivityFeed/)

  assert.match(liveStateSource, /createDashboardBrowserClient/)
  assert.match(liveStateSource, /fetchPanoSnapshot/)
  assert.match(liveStateSource, /fetchPanoTableStatuses/)
  assert.match(liveStateSource, /table: 'orders'/)
  assert.match(liveStateSource, /table: 'table_sessions'/)
  assert.match(liveStateSource, /scheduleSnapshotRefresh/)

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
