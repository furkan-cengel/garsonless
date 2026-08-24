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
const panoActionsSource = readFileSync(`${directory}/../../lib/actions/pano.ts`, 'utf8')
const globalStylesSource = readFileSync(`${directory}/../../app/globals.css`, 'utf8')
const shellSource = readFileSync(`${directory}/../layout/RestaurantShell.tsx`, 'utf8')
const activityFeedSource = readFileSync(`${directory}/PanoActivityFeed.tsx`, 'utf8')
const liveStateSource = readFileSync(`${directory}/use-pano-live-state.ts`, 'utf8')
const approvalControllerSource = readFileSync(`${directory}/use-pano-order-approval.ts`, 'utf8')
const pageTopBarSource = readFileSync(`${directory}/../layout/PageTopBar.tsx`, 'utf8')
const attentionTablesSource = readFileSync(`${directory}/PanoAttentionTables.tsx`, 'utf8')
const stylesSource = readFileSync(`${directory}/PanoStyles.tsx`, 'utf8')
const iconRailSource = readFileSync(`${directory}/../layout/IconRail.tsx`, 'utf8')
const formatSource = readFileSync(`${directory}/../../lib/pano-format.ts`, 'utf8')

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
  assert.match(salesChartSource, /<ToggleGroup/)
  assert.match(salesChartSource, /value=\{\[data\.range\]\}/)
  assert.doesNotMatch(salesChartSource, /<title|<desc/)
  assert.doesNotMatch(salesChartSource, /lib\/actions|createClient|supabase|restaurantId/i)

  assert.match(chartModelSource, /export const PANO_CHART_RANGES/)
  assert.match(chartModelSource, /export function createDayPanoChart/)
  assert.match(chartModelSource, /export function navigatePanoChartIndex/)
  assert.doesNotMatch(chartModelSource, /useState|useEffect|lib\/actions|createClient|supabase|react/i)
})

test('Pano server action module only exports async functions', () => {
  assert.match(panoActionsSource, /^'use server'/)
  assert.match(panoActionsSource, /export async function fetchPanoSnapshot/)
  assert.match(panoActionsSource, /export async function fetchPanoChart/)
  assert.doesNotMatch(panoActionsSource, /export\s+(?:type|interface|const|class|enum)\b|export\s*\{/)
})

test('Pano responsive shell exposes a two-row mobile header, 44px targets and reduced-motion support', () => {
  assert.match(clientSource, /className="page-topbar--pano"/)
  assert.match(clientSource, /<Collapsible className="pano-analytics"/)
  assert.match(clientSource, /<CollapsibleTrigger className="pano-analytics-summary">/)
  assert.match(widgetSource, /aria-label="Yoğun saat görünümü"/)
  assert.match(widgetSource, /<Table>/)
  assert.match(stylesSource, /grid-template-rows: 52px 52px/)
  assert.match(stylesSource, /@media \(max-width: 900px\)/)
  assert.match(stylesSource, /\.page-topbar--pano \.page-topbar-tag \{ display: flex !important;/)
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
  assert.match(liveStateSource, /await import\('\.\.\/\.\.\/lib\/supabase'\)/)
  assert.doesNotMatch(liveStateSource, /import \{ createDashboardBrowserClient \} from/)
  assert.match(shellSource, /import\('\.\.\/\.\.\/lib\/supabase'\)/)
  assert.doesNotMatch(shellSource, /import \{ createDashboardBrowserClient \} from/)
  assert.match(liveStateSource, /fetchPanoSnapshot/)
  assert.doesNotMatch(liveStateSource, /fetchPanoTableStatuses/)
  assert.equal(liveStateSource.match(/\.channel\(/g)?.length, 1)
  assert.match(liveStateSource, /channel\(`pano:\$\{restaurantId\}:/)
  assert.match(liveStateSource, /table: 'pano_invalidations'/)
  assert.doesNotMatch(liveStateSource, /table: '(?:orders|table_sessions|payment_shares|service_requests|tables)'/)
  assert.match(liveStateSource, /scheduleSnapshotRefresh/)
  assert.match(liveStateSource, /panoReconnectDelay/)
  assert.match(liveStateSource, /PANO_EVENT_MAX_WAIT_MS/)
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
  assert.match(liveStateSource, /new Date\(initialSnapshot\.generatedAt\)/)
  assert.match(liveStateSource, /lastSuccessfulAt/)
  assert.doesNotMatch(clientSource, /new Date\(\)\.toLocaleDateString/)
  assert.doesNotMatch(activityFeedSource, /Date\.now\(\)/)
  assert.match(activityFeedSource, /now\.getTime\(\)/)
  assert.match(pageTopBarSource, /suppressHydrationWarning/)
  assert.match(pageTopBarSource, /visibility: notificationCount > 0 \? 'visible' : 'hidden'/)
})

test('Pano topbar keeps its primary action compact and restaurant switching visibly interactive', () => {
  assert.match(stylesSource, /\.page-topbar--pano \.pano-action-primary \{ position: relative; min-height: 30px; \}/)
  assert.match(stylesSource, /\.page-topbar--pano \.pano-action-primary::after \{ content: ''; position: absolute; inset: -7px 0; \}/)
  assert.match(pageTopBarSource, /className="page-topbar-restaurant-chevron"/)
  assert.match(globalStylesSource, /\.page-topbar-restaurant:not\(:disabled\):hover \{/)
  assert.match(globalStylesSource, /\.page-topbar-restaurant:not\(:disabled\):hover \.page-topbar-restaurant-chevron \{/)
  assert.match(globalStylesSource, /\.page-topbar-notification:not\(:disabled\):hover \{/)
  assert.match(globalStylesSource, /background: var\(--surface-inset\) !important;/)
  assert.match(globalStylesSource, /transform: translateY\(-1px\);/)
})

test('Pano table navigation uses shadcn link composition and chart ranges stay visually compact', () => {
  assert.match(attentionTablesSource, /render=\{<Link href=/)
  assert.match(attentionTablesSource, /buttonVariants\(\{ variant: 'ghost', size: 'sm' \}\)/)
  assert.match(stylesSource, /\.pano-chart-ranges \{ min-height: 44px; \}/)
  assert.match(stylesSource, /\.pano-chart-ranges button \{ position: relative; min-height: 44px; \}/)
})

test('Pano peak-hour cells expose hover and keyboard tooltips', () => {
  assert.doesNotMatch(widgetSource, /className="pano-heatmap-scroll" aria-hidden/)
  assert.match(widgetSource, /className="pano-heatmap-cell"/)
  assert.match(widgetSource, /tabIndex=\{count > 0 \? 0 : -1\}/)
  assert.match(widgetSource, /aria-hidden=\{count === 0 \? 'true' : undefined\}/)
  assert.match(widgetSource, /onMouseEnter=/)
  assert.match(widgetSource, /onFocus=/)
  assert.match(widgetSource, /role="tooltip"/)
  assert.match(widgetSource, /<span>\{tooltip\.count\} sipariş<\/span>/)
  assert.doesNotMatch(widgetSource, /title=\{label\}/)
  assert.match(stylesSource, /\.pano-heatmap-scroll \{[^}]*overflow-x: auto;[^}]*overflow-y: hidden;[^}]*padding: 6px;/)
  assert.match(stylesSource, /\.pano-heatmap-cell\[tabindex="0"\]:hover/)
  assert.match(stylesSource, /\.pano-heatmap-tooltip \{ position: fixed;/)
})

test('Pano peak-hour view switches in place instead of appending an expanding table', () => {
  assert.match(widgetSource, /useState<'heatmap' \| 'table'>\('heatmap'\)/)
  assert.match(widgetSource, /value=\{\[view\]\}/)
  assert.match(widgetSource, /<ToggleGroupItem value="heatmap">/)
  assert.match(widgetSource, /<ToggleGroupItem value="table">/)
  assert.match(widgetSource, /view === 'heatmap' \? \(/)
  assert.doesNotMatch(widgetSource, /<details|<summary/)
  assert.doesNotMatch(widgetSource, /<button[^>]*aria-pressed/)
  assert.match(stylesSource, /\.pano-peak-view \{ min-height: 292px; \}/)
})

test('Pano composes shadcn primitives for cards, feedback, lists, loading and data controls', () => {
  assert.match(widgetSource, /from '@\/components\/ui\/card'/)
  assert.match(widgetSource, /from '@\/components\/ui\/empty'/)
  assert.match(widgetSource, /from '@\/components\/ui\/item'/)
  assert.match(widgetSource, /from '@\/components\/ui\/progress'/)
  assert.match(widgetSource, /from '@\/components\/ui\/skeleton'/)
  assert.match(clientSource, /from '@\/components\/ui\/alert'/)
  assert.match(clientSource, /from '@\/components\/ui\/badge'/)
  assert.match(activityFeedSource, /from '@\/components\/ui\/scroll-area'/)
  assert.match(salesChartSource, /from '@\/components\/ui\/table'/)
})

test('Pano loading and pending states announce once while keeping spinners decorative', () => {
  assert.match(widgetSource, /<Card size="sm" role="status" aria-live="polite" aria-busy="true"/)
  assert.match(widgetSource, /<span className="sr-only">\{label\}<\/span>/)
  assert.match(widgetSource, /<div aria-hidden="true" className="contents">/)
  assert.match(widgetSource, /disabled=\{retrying\} aria-busy=\{retrying\}/)
  assert.match(clientSource, /disabled=\{refreshing\} aria-busy=\{refreshing\}/)
  for (const source of [widgetSource, clientSource, activityFeedSource, salesChartSource]) {
    assert.doesNotMatch(source, /<Spinner[^>]+aria-label=/)
  }
  assert.match(`${widgetSource}\n${clientSource}\n${activityFeedSource}\n${salesChartSource}`, /<Spinner[^>]+aria-hidden="true"/)
})

test('Pano uses one sans-serif numeric hierarchy and one TRY formatter', () => {
  assert.match(widgetSource, /min-h-\[126px\]/)
  assert.match(widgetSource, /pano-metric-value text-\[24px\] leading-none font-bold/)
  assert.match(widgetSource, /text-\[11\.5px\]/)
  assert.match(widgetSource, /text-\[10\.5px\]/)
  assert.match(stylesSource, /\.pano-number, \.pano-metric-value \{ font-variant-numeric: tabular-nums lining-nums;/)
  assert.match(formatSource, /new Intl\.NumberFormat\('tr-TR'/)
  assert.match(formatSource, /currencyDisplay: 'narrowSymbol'/)
  assert.match(attentionTablesSource, /formatPanoCurrency\(remainingTotal\(table\)\)/)
  assert.match(activityFeedSource, /formatPanoCurrency\(event\.total\)/)
  assert.match(salesChartSource, /formatPanoCurrency\(data\.total\)/)
  assert.doesNotMatch(`${widgetSource}\n${attentionTablesSource}\n${activityFeedSource}\n${salesChartSource}`, /S\.mono|font-mono| TL kalan|₺\{/)
})

test('Pano ends at its final cards without a chained blank scroll tail', () => {
  assert.match(stylesSource, /\.pano-shell \{[^}]*padding: 28px 32px 16px;/)
  assert.match(stylesSource, /\.pano-lower-grid \{[^}]*margin-bottom: 0;/)
  assert.match(clientSource, /overscrollBehaviorY: 'contain'/)
  assert.match(shellSource, /height: '100dvh'/)
  assert.match(shellSource, /maxHeight: '100dvh'/)
})
