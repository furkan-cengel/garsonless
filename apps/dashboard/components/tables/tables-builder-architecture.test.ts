import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const shellSource = readFileSync(`${directory}/TablesBuilderShell.tsx`, 'utf8')
const operationsShellSource = readFileSync(`${directory}/TablesOperationsShell.tsx`, 'utf8')
const frameSource = readFileSync(`${directory}/TablesShellFrame.tsx`, 'utf8')
const qrPickerSource = readFileSync(`${directory}/TablesQRTablePicker.tsx`, 'utf8')
const qrPickerContentSource = readFileSync(`${directory}/TablesQRPickerContent.tsx`, 'utf8')
const operationsPageSource = readFileSync(`${directory}/../../app/dashboard/[restaurantId]/tables/page.tsx`, 'utf8')
const qrPageSource = readFileSync(`${directory}/../../app/dashboard/[restaurantId]/tables/qr/page.tsx`, 'utf8')
const propertiesSource = readFileSync(`${directory}/TablesQRProperties.tsx`, 'utf8')
const propertiesModelSource = readFileSync(`${directory}/use-tables-qr-properties-model.ts`, 'utf8')
const propertiesChromeSource = readFileSync(`${directory}/TablesQRPropertiesChrome.tsx`, 'utf8')
const propertiesSectionsSource = readFileSync(`${directory}/TablesQRPropertiesSections.tsx`, 'utf8')
const propertiesLogoSource = readFileSync(`${directory}/TablesQRLogoSection.tsx`, 'utf8')
const propertiesControlsSource = readFileSync(`${directory}/tables-qr-property-controls.tsx`, 'utf8')
const navigationSource = readFileSync(`${directory}/TablesNavigation.tsx`, 'utf8')
const navigationModelSource = readFileSync(`${directory}/use-tables-navigation-model.ts`, 'utf8')
const navigationHeaderSource = readFileSync(`${directory}/TablesNavigationHeader.tsx`, 'utf8')
const navigationFiltersSource = readFileSync(`${directory}/TablesNavigationFilters.tsx`, 'utf8')
const navigationListSource = readFileSync(`${directory}/TablesNavigationList.tsx`, 'utf8')
const navigationRowSource = readFileSync(`${directory}/TablesNavigationTableRow.tsx`, 'utf8')
const responsiveNavigationSource = readFileSync(`${directory}/TablesResponsiveNavigation.tsx`, 'utf8')
const managementSource = readFileSync(`${directory}/use-table-management.ts`, 'utf8')
const canvasSource = readFileSync(`${directory}/TablesQRCanvas.tsx`, 'utf8')
const rendererSource = readFileSync(`${directory}/tables-qr-renderer.ts`, 'utf8')
const qrExportSource = readFileSync(`${directory}/tables-qr-export.ts`, 'utf8')
const qrPdfSource = readFileSync(`${directory}/tables-qr-pdf.ts`, 'utf8')
const chromeSource = readFileSync(`${directory}/TablesBuilderChrome.tsx`, 'utf8')
const rotationSource = readFileSync(`${directory}/use-table-qr-token-rotation.ts`, 'utf8')
const rotationDialogSource = readFileSync(`${directory}/TablesQRRotationDialog.tsx`, 'utf8')
const transferDialogSource = readFileSync(`${directory}/TableTransferDialog.tsx`, 'utf8')
const transferOrdersLoadSource = readFileSync(`${directory}/transfer-orders-load.ts`, 'utf8')
const transferOrderSelectorSource = readFileSync(`${directory}/TableTransferOrderSelector.tsx`, 'utf8')
const transferSelectionModelSource = readFileSync(`${directory}/table-transfer-selection-model.ts`, 'utf8')
const transferHistorySource = readFileSync(`${directory}/TableTransferHistory.tsx`, 'utf8')
const transferHistoryModelSource = readFileSync(`${directory}/table-transfer-history-model.ts`, 'utf8')
const transferFeedbackSource = readFileSync(`${directory}/use-table-transfer-feedback.ts`, 'utf8')
const tableActionsSource = readFileSync(`${directory}/../../lib/actions/tables.ts`, 'utf8')
const tableQuerySource = readFileSync(`${directory}/../../lib/queries/tables.ts`, 'utf8')
const liveStateSource = readFileSync(`${directory}/use-tables-live-state.ts`, 'utf8')
const realtimeChannelHookSource = readFileSync(`${directory}/use-tables-realtime-channel.ts`, 'utf8')
const realtimeChannelRuntimeSource = readFileSync(`${directory}/tables-realtime-channel-runtime.ts`, 'utf8')
const realtimeChannelSource = `${realtimeChannelHookSource}\n${realtimeChannelRuntimeSource}`
const operationModelSource = readFileSync(`${directory}/tables-operation-model.ts`, 'utf8')
const floorCanvasSource = readFileSync(`${directory}/TablesFloorCanvas.tsx`, 'utf8')
const floorToolbarSource = readFileSync(`${directory}/TablesFloorToolbar.tsx`, 'utf8')
const floorCardSource = readFileSync(`${directory}/TablesFloorCard.tsx`, 'utf8')
const floorLayoutControllerSource = readFileSync(`${directory}/use-table-floor-layout.ts`, 'utf8')
const floorLayoutExternalSyncSource = readFileSync(`${directory}/use-table-layout-external-sync.ts`, 'utf8')
const floorLayoutModelSource = readFileSync(`${directory}/table-floor-layout-model.ts`, 'utf8')
const legacyLayoutModelSource = readFileSync(`${directory}/legacy-table-layout-model.ts`, 'utf8')
const floorActionsSource = readFileSync(`${directory}/use-table-floor-actions.tsx`, 'utf8')
const transferPrefetchSource = readFileSync(`${directory}/use-transfer-orders-prefetch.ts`, 'utf8')
const quickActionMenuSource = readFileSync(`${directory}/TableQuickActionMenu.tsx`, 'utf8')
const detailPanelSource = readFileSync(`${directory}/TableDetailPanel.tsx`, 'utf8')
const detailSurfaceSource = readFileSync(`${directory}/TableDetailSurface.tsx`, 'utf8')
const accessibleDialogSource = readFileSync(`${directory}/AccessibleDialog.tsx`, 'utf8')
const newOrderModalSource = readFileSync(`${directory}/../overlays/NewOrderModal.tsx`, 'utf8')
const panoActionsSource = readFileSync(`${directory}/../../lib/actions/pano.ts`, 'utf8')
const qrStyleEditorSource = readFileSync(`${directory}/use-qr-style-editor.ts`, 'utf8')
const qrStyleSaveModelSource = readFileSync(`${directory}/qr-style-save-model.ts`, 'utf8')
const routeSkeletonSource = readFileSync(`${directory}/TablesRouteSkeleton.tsx`, 'utf8')
const operationsLoadingSource = readFileSync(`${directory}/../../app/dashboard/[restaurantId]/tables/loading.tsx`, 'utf8')
const qrLoadingSource = readFileSync(`${directory}/../../app/dashboard/[restaurantId]/tables/qr/loading.tsx`, 'utf8')
const genericRouteSkeletonSource = readFileSync(`${directory}/../layout/DashboardRouteSkeleton.tsx`, 'utf8')
const panoClientSource = readFileSync(`${directory}/../pano/PanoClient.tsx`, 'utf8')
const panoAttentionTablesSource = readFileSync(`${directory}/../pano/PanoAttentionTables.tsx`, 'utf8')

test('tables builder shell delegates the QR Studio properties panel', () => {
  assert.match(shellSource, /dynamic\(\(\) => import\('\.\/TablesQRProperties'\)/)
  assert.match(shellSource, /<TablesQRProperties/)
  assert.doesNotMatch(shellSource, /function QRProps|function ShapeTab|function ColorTab|function LogoTab/)
  assert.doesNotMatch(shellSource, /QRProps shared primitives/)
})

test('QR properties stays a callback-driven UI boundary', () => {
  assert.match(propertiesSource, /export function TablesQRProperties/)
  assert.match(propertiesSource, /setQR: \(q: QRConfig\) => void/)
  const qrPropertiesBoundary = `${propertiesSource}\n${propertiesModelSource}\n${propertiesChromeSource}\n${propertiesSectionsSource}\n${propertiesLogoSource}\n${propertiesControlsSource}`
  assert.doesNotMatch(qrPropertiesBoundary, /lib\/actions|createClient|useTablesLiveState|useQRStyleEditor/)
  assert.doesNotMatch(qrPropertiesBoundary, /restaurantId|supabase|channel\(/i)
})

test('QR properties delegates view-model, chrome and section presentation', () => {
  assert.match(propertiesSource, /useTablesQRPropertiesModel/)
  assert.match(propertiesSource, /<TablesQRPropertiesHeader/)
  assert.match(propertiesSource, /advanced=\{model\.advanced\}/)
  assert.match(propertiesSource, /<TablesQRPropertiesSection/)
  assert.match(propertiesSource, /<TablesQRPropertiesFooter/)
  assert.doesNotMatch(propertiesSource, /useState|FileReader|function ShapeTab|function ColorTab|function LogoTab|function FrameTab|function DataTab/)
  assert.match(propertiesModelSource, /defaultQR/)
  assert.match(propertiesModelSource, /mode === 'begin'/)
  assert.match(propertiesSectionsSource, /<TablesQRLogoSection/)
  assert.doesNotMatch(`${propertiesChromeSource}\n${propertiesSectionsSource}\n${propertiesLogoSource}\n${propertiesControlsSource}`, /setQR|replaceQR|beginQRChange/)
})

test('QR properties decomposition budgets prevent another monolithic panel', () => {
  const budgets = [
    ['TablesQRProperties', propertiesSource, 100],
    ['useTablesQRPropertiesModel', propertiesModelSource, 110],
    ['TablesQRPropertiesChrome', propertiesChromeSource, 170],
    ['TablesQRPropertiesSections', propertiesSectionsSource, 260],
    ['TablesQRLogoSection', propertiesLogoSource, 170],
    ['QR property controls', propertiesControlsSource, 330],
  ] as const
  for (const [name, source, budget] of budgets) {
    const lines = source.split('\n').length
    assert.ok(lines <= budget, `${name} grew to ${lines} lines`)
  }
})

test('tables navigation delegates CRUD commands to its feature hook', () => {
  assert.match(operationsShellSource, /import \{ TablesNavigation \}/)
  assert.match(operationsShellSource, /<TablesNavigation/)
  assert.doesNotMatch(operationsShellSource, /createTable|renameTable|deleteTable|function TablesNav/)
  assert.match(navigationSource, /useTableManagement/)
  assert.doesNotMatch(navigationSource, /lib\/actions|createTable|renameTable|deleteTable/)
  assert.match(managementSource, /createTable, deleteTable, renameTable/)
  assert.match(managementSource, /filterTables|renameTableInList|removeTableFromList/)
})

test('operational status and location filters share one deterministic projection', () => {
  assert.match(navigationModelSource, /filterOperationalTables/)
  assert.match(navigationListSource, /tableOperationalState/)
  assert.match(navigationSource, /now/)
  assert.match(operationsShellSource, /useOperationalNow\(initialNow\)/)
  assert.doesNotMatch(`${navigationSource}\n${navigationModelSource}\n${navigationListSource}`, /sipariş bugün|function LiveSessionDuration/)
  assert.match(operationModelSource, /@garsonless\/application\/table-operations/)
  assert.match(operationModelSource, /projectTableAttentionState/)
  assert.match(operationModelSource, /export \{ TABLE_LATE_AFTER_MINUTES \}/)
  assert.match(operationModelSource, /UNASSIGNED_LOCATION_FILTER/)
  assert.doesNotMatch(operationModelSource, /lib\/actions|createClient|supabase/i)
})

test('live tables delegates the spatial plan, card and persistence controller', () => {
  assert.match(navigationSource, /<TablesFloorCanvas/)
  assert.match(floorCanvasSource, /useTableFloorLayout/)
  assert.match(floorCanvasSource, /<TablesFloorCard/)
  assert.match(floorLayoutControllerSource, /saveTableLayout/)
  assert.match(floorLayoutControllerSource, /expectedRevision: snapshot\.revision/)
  assert.match(floorLayoutModelSource, /buildTableLayoutDraft/)
  assert.match(floorLayoutModelSource, /collidingTableIds/)
  assert.doesNotMatch(`${floorCanvasSource}\n${floorCardSource}\n${floorLayoutModelSource}`, /createClient|supabase/i)
  assert.doesNotMatch(floorLayoutModelSource, /lib\/actions|useState|useEffect/)
})

test('floor plan boundaries stay reviewable instead of becoming another monolith', () => {
  const budgets = [
    ['TablesFloorCanvas', floorCanvasSource, 190],
    ['TablesFloorToolbar', floorToolbarSource, 160],
    ['TablesFloorCard', floorCardSource, 170],
    ['useTableFloorLayout', floorLayoutControllerSource, 180],
    ['useTableLayoutExternalSync', floorLayoutExternalSyncSource, 150],
    ['table floor layout model', floorLayoutModelSource, 170],
  ] as const
  for (const [name, source, budget] of budgets) {
    assert.ok(source.split('\n').length <= budget, `${name} grew beyond ${budget} lines`)
  }
})

test('table detail has one tables-owned read contract and lazy presentation surfaces', () => {
  assert.match(tableActionsSource, /export async function fetchTableDetail/)
  assert.doesNotMatch(panoActionsSource, /fetchPanoTableDetail|PanoTableDetail/)
  assert.match(detailPanelSource, /fetchTableDetail\(restaurantId, table\.id\)/)
  assert.match(operationsShellSource, /dynamic\(\(\) => import\('\.\/TableDetailSurface'\)/)
  assert.match(operationsShellSource, /dynamic\(\(\) => import\('\.\.\/overlays\/NewOrderModal'\)/)
  assert.doesNotMatch(detailPanelSource, /createClient|supabase/i)
})

test('table detail keeps the canonical boundary and order creation composes shadcn dialog primitives', () => {
  assert.match(detailSurfaceSource, /<AccessibleDialog/)
  assert.match(newOrderModalSource, /<Dialog open/)
  assert.match(newOrderModalSource, /<DialogContent/)
  assert.match(newOrderModalSource, /<DialogTitle[^>]*>Yeni sipariş oluştur/)
  assert.match(newOrderModalSource, /<DialogFooter/)
  assert.match(newOrderModalSource, /<ScrollArea/)
  assert.match(newOrderModalSource, /<ToggleGroup/)
  assert.match(newOrderModalSource, /<Card/)
  assert.match(newOrderModalSource, /<Empty/)
  assert.match(accessibleDialogSource, /role=\{role\}/)
  assert.match(accessibleDialogSource, /aria-modal="true"/)
  assert.match(accessibleDialogSource, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(accessibleDialogSource, /sibling\.inert = true/)
  assert.match(accessibleDialogSource, /event\.key === 'Escape'/)
  assert.match(accessibleDialogSource, /event\.key !== 'Tab'/)
})

test('quick table operations expose equivalent pointer, keyboard and mobile entry points', () => {
  assert.match(floorCardSource, /onContextMenu=\{openContextMenu\}/)
  assert.match(floorCardSource, /event\.key === 'ContextMenu'/)
  assert.match(floorCardSource, /event\.shiftKey && event\.key === 'F10'/)
  assert.match(floorCardSource, /tb-floor-card__more/)
  assert.match(quickActionMenuSource, /role="menu"/)
  assert.match(quickActionMenuSource, /role="menuitem"/)
  assert.match(quickActionMenuSource, /'ArrowDown', 'ArrowUp', 'Home', 'End'/)
  assert.match(quickActionMenuSource, /restoreFocus\.focus\(\)/)
  assert.match(floorActionsSource, /buildTableQuickActions/)
  assert.doesNotMatch(`${quickActionMenuSource}\n${floorActionsSource}`, /createClient|supabase/i)
})

test('product transfer selection stays quantity-aware and delegates money writes to the server', () => {
  assert.match(transferDialogSource, /FieldLabel htmlFor="table-transfer-target"/)
  assert.match(transferDialogSource, /SelectTrigger id="table-transfer-target"/)
  assert.match(transferDialogSource, /SelectValue placeholder="Masa seçin">\{targetId \? tableLabel\(targetId\) : undefined\}/)
  assert.match(transferDialogSource, /<TableTransferOrderSelector/)
  assert.match(transferDialogSource, /transferOrderItemsToTable/)
  assert.match(transferDialogSource, /selectionNeedsOrderSplit/)
  assert.match(transferOrderSelectorSource, /taşınacak adet/)
  assert.match(transferOrderSelectorSource, /indeterminate=\{state === 'partial'\}/)
  assert.match(transferOrderSelectorSource, /data-transfer-product-row/)
  assert.match(transferOrderSelectorSource, /<Checkbox/)
  assert.match(transferOrderSelectorSource, /data-transfer-product-value/)
  assert.match(transferOrderSelectorSource, /item\.quantity === 1/)
  assert.match(transferOrderSelectorSource, /taşınacak adet: 1 \/ 1/)
  assert.match(transferOrderSelectorSource, /<SelectContent align="end" alignItemWithTrigger=\{false\}/)
  assert.doesNotMatch(transferOrderSelectorSource, /NativeSelect/)
  assert.match(transferDialogSource, /loadTransferableOrders/)
  assert.match(transferOrdersLoadSource, /getTransferableSessionOrders/)
  assert.match(transferOrdersLoadSource, /resultTtlMs: TRANSFER_ORDERS_CACHE_TTL_MS/)
  assert.match(transferOrdersLoadSource, /shouldCache: .*Array\.isArray/)
  assert.match(transferPrefetchSource, /import\('\.\/TableTransferDialog'\)/)
  assert.match(transferPrefetchSource, /prefetchTransferableOrders\(restaurantId, session\)/)
  assert.match(transferPrefetchSource, /import\('\.\/SettlementSheet'\)/)
  assert.match(transferPrefetchSource, /prefetchSessionSettlement\(restaurantId, session\)/)
  assert.match(quickActionMenuSource, /role="menu"/)
  assert.match(floorActionsSource, /onPrefetchTransfer\(tableId\)/)
  assert.doesNotMatch(transferDialogSource, /getSessionSettlement/)
  assert.match(transferDialogSource, /const sourceSessionId = sourceSession\?\.sessionId/)
  assert.match(transferDialogSource, /\[[^\]]*sourceSessionId[^\]]*wholeAccountOnlyReason\]\)/)
  assert.doesNotMatch(transferDialogSource, /\[[^\]]*, sourceSession, [^\]]*\]\)/)
  assert.match(transferSelectionModelSource, /selectedTransferItems/)
  assert.match(tableActionsSource, /transferTableOrderItems/)
  assert.doesNotMatch(`${transferOrderSelectorSource}\n${transferSelectionModelSource}`, /lib\/actions|createClient|supabase/i)
})

test('tables builder delegates QR canvas and browser export rendering', () => {
  assert.match(shellSource, /import \{ TablesQRCanvas \}/)
  assert.match(shellSource, /<TablesQRCanvas/)
  assert.doesNotMatch(shellSource, /function QRCanvas|downloadTableCard|renderTableCardSVG|printTableCards/)
  assert.match(canvasSource, /export function TablesQRCanvas/)
  assert.match(canvasSource, /downloadTableCard|printTableCards|loadQRCodeStyling/)
  assert.match(canvasSource, /import\('\.\/tables-qr-export'\)/)
  assert.doesNotMatch(canvasSource, /lib\/actions|createClient|supabase|restaurantId|useTablesLiveState/i)
  assert.match(rendererSource, /export async function validateRenderedQR/)
  assert.match(rendererSource, /export function buildQRCodeStylingOptions/)
  assert.match(qrExportSource, /MAX_QR_EXPORT_CONCURRENCY = 4/)
  assert.match(qrPdfSource, /await import\('pdf-lib'\)/)
  assert.doesNotMatch(rendererSource, /downloadTableCard|printTableCards/)
  assert.match(canvasSource, /buildQRCodeStylingOptions/)
  assert.doesNotMatch(`${canvasSource}\n${rendererSource}\n${qrExportSource}\n${qrPdfSource}`, /as any/)
  assert.doesNotMatch(`${rendererSource}\n${qrExportSource}\n${qrPdfSource}`, /lib\/actions|createClient|supabase|restaurantId|useTablesLiveState/i)
})

test('tables builder delegates its topbar and preview chrome', () => {
  assert.match(shellSource, /import \{ TablesMobilePreview, TablesTopBar \}/)
  assert.match(shellSource, /<TablesTopBar/)
  assert.match(shellSource, /<TablesMobilePreview/)
  assert.doesNotMatch(shellSource, /function TablesTopBar|function TablesMobilePreview|const PRESETS|TablesStatusBar/)
  assert.match(chromeSource, /export function TablesTopBar/)
  assert.match(chromeSource, /export function TablesMobilePreview/)
  assert.doesNotMatch(chromeSource, /lib\/actions|createClient|supabase|restaurantId|useTablesLiveState|useQRStyleEditor/i)
})

test('QR optimistic persistence uses server revisions and validates before save', () => {
  assert.match(qrStyleEditorSource, /acknowledgedRef/)
  assert.match(qrStyleEditorSource, /expectedRevision/)
  assert.match(qrStyleEditorSource, /resolution\.kind === 'rollback'/)
  assert.match(qrStyleEditorSource, /conflictFingerprintRef/)
  assert.match(qrStyleEditorSource, /preservesConflictFeedback/)
  assert.match(qrStyleEditorSource, /inspectQRStyleSafety/)
  assert.match(qrStyleEditorSource, /persistValidated/)
  assert.match(qrStyleEditorSource, /result\.state === 'invalid'/)
  assert.match(qrStyleEditorSource, /saveQRStyle\(restaurantId, toPersistedQRStyle\(next\), expectedRevision\)/)
  assert.match(tableActionsSource, /inspectQRStyleSafety\(parsed\.data\)/)
  assert.match(qrStyleSaveModelSource, /QR_STYLE_CONFLICT_MESSAGE/)
  assert.match(qrStyleSaveModelSource, /qrStylesEqual/)
  assert.doesNotMatch(qrStyleSaveModelSource, /lib\/actions|createClient|supabase/i)
})

test('QR Studio renders the active preview immediately and defers only the multi-table grid', () => {
  assert.match(canvasSource, /const deferredGridQR = React\.useDeferredValue\(qr\)/)
  assert.match(canvasSource, /const url = buildUrl\(qr, table\)/)
  assert.match(canvasSource, /buildQRCodeStylingOptions\(qr, \{[\s\S]*?type: 'canvas'/)
  assert.match(canvasSource, /<GridCard key=\{t\.id\} qr=\{deferredGridQR\}/)
  assert.doesNotMatch(canvasSource, /buildUrl\(deferredGridQR, table\)/)
})

test('modal-only table operations stay behind their route-specific interaction chunks', () => {
  assert.match(operationsShellSource, /import dynamic from 'next\/dynamic'/)
  assert.match(shellSource, /import dynamic from 'next\/dynamic'/)
  for (const component of ['SettlementSheet', 'TableTransferDialog']) {
    assert.doesNotMatch(operationsShellSource, new RegExp(`import (?:\\{ )?${component}(?: \\})? from`))
    assert.match(operationsShellSource, new RegExp(`dynamic\\(\\(\\) => import\\('./${component}'\\)`))
    assert.doesNotMatch(shellSource, new RegExp(component))
  }
  for (const component of ['TablesQRRotationDialog']) {
    assert.doesNotMatch(shellSource, new RegExp(`import (?:\\{ )?${component}(?: \\})? from`))
    assert.match(shellSource, new RegExp(`dynamic\\(\\(\\) => import\\('./${component}'\\)`))
    assert.doesNotMatch(operationsShellSource, new RegExp(component))
  }
  assert.match(operationsShellSource, /\{settlementTarget && \(/)
  assert.doesNotMatch(shellSource, /QRHealthDialog|healthDialogOpen/)
  assert.match(shellSource, /\{qrTokenRotation\.target && \(/)
  assert.match(operationsShellSource, /\{transfer && \(/)
  assert.match(`${shellSource}\n${operationsShellSource}`, /Pencere hazırlanıyor…/)
  assert.match(shellSource, /<AccessibleDialog labelledBy="qr-dialog-loading-title"[\s\S]*closeDisabled/)
  assert.match(operationsShellSource, /<AccessibleDialog labelledBy="operations-dialog-loading-title"[\s\S]*closeDisabled/)
})

test('live operations and QR Studio are separate addressable route boundaries', () => {
  assert.match(operationsPageSource, /TablesOperationsClientLoader/)
  assert.match(operationsPageSource, /resolveTableDeepLink\(query\.tableId, tables\)/)
  assert.match(operationsPageSource, /initialTableId=\{initialTableId\}/)
  assert.doesNotMatch(operationsPageSource, /TablesBuilderShell|listDashboardTableQrTokens|initialQRStyle|restaurantSlug/)
  assert.match(qrPageSource, /TablesBuilderClientLoader/)
  assert.match(qrPageSource, /listDashboardTableQrTokens/)
  assert.doesNotMatch(qrPageSource, /getOpenTableSessions|initialOpenSessions|initialNow/)
  assert.match(frameSource, /Canlı Masalar/)
  assert.match(frameSource, /QR Studio/)
  assert.match(frameSource, /aria-current/)
  assert.equal(frameSource.match(/prefetch=\{false\}/g)?.length, 2)
  assert.match(shellSource, /TablesQRTablePicker/)
  assert.match(`${qrPickerSource}\n${qrPickerContentSource}`, /Canlı Masalar · Plus/)
  assert.match(qrPickerContentSource, /Masayı oluştur/)
  assert.doesNotMatch(shellSource, /useTablesLiveState|TablesNavigation|SettlementSheet|TableTransferDialog|useTableTransferFeedback/)
  assert.doesNotMatch(operationsShellSource, /useQRStyleEditor|TablesQRCanvas|TablesQRProperties|TablesTopBar|TablesStatusBar/)
  assert.doesNotMatch(navigationSource, /PNG\/SVG|PDF export/)
})

test('table directory failures remain distinct from a genuinely empty restaurant', () => {
  assert.match(tableQuerySource, /export type TablesDirectoryResult/)
  assert.match(tableQuerySource, /ok: false; tables: \[\]; error: string/)
  assert.match(operationsPageSource, /initialDirectoryError=\{tablesResult\.ok \? null : tablesResult\.error\}/)
  assert.match(qrPageSource, /initialDirectoryError=\{tablesResult\.ok \? null : tablesResult\.error\}/)
  assert.match(shellSource, /role="alert" className="tb-tables__directory-error"/)
})

test('table actions expose stable localized failures without raw adapter errors', () => {
  assert.match(tableActionsSource, /export type TablesActionResult<T>/)
  assert.match(tableActionsSource, /TablesActionErrorCode/)
  assert.doesNotMatch(tableActionsSource, /return \{ error: result\.error \}/)
  assert.doesNotMatch(tableActionsSource, /Not authorized|Invalid input|Table not found|Session not found/)
})

test('tables section tabs stay in the content column beside the persistent icon rail', () => {
  for (const source of [operationsShellSource, shellSource]) {
    assert.match(source, /tb-tables__body[\s\S]*<TablesIconRail[\s\S]*tb-tables__content[\s\S]*<TablesSectionTabs/)
  }
  assert.match(frameSource, /\.tb-tables__body \{[^}]*display: flex/)
  assert.match(frameSource, /\.tb-tables__content \{[^}]*flex-direction: column/)
})

test('table routes expose task-specific, accessible loading boundaries', () => {
  assert.match(operationsLoadingSource, /TablesRouteSkeleton variant="operations"/)
  assert.match(qrLoadingSource, /TablesRouteSkeleton variant="qr"/)
  assert.doesNotMatch(`${operationsLoadingSource}\n${qrLoadingSource}`, /DashboardRouteSkeleton/)
  assert.doesNotMatch(genericRouteSkeletonSource, /TablesSkeleton|tables: <|\| 'tables'/)
  assert.match(routeSkeletonSource, /Canlı masa görünümü hazırlanıyor/)
  assert.match(routeSkeletonSource, /QR Studio hazırlanıyor/)
  assert.match(routeSkeletonSource, /role="status"/)
  assert.match(routeSkeletonSource, /aria-live="polite"/)
  assert.match(routeSkeletonSource, /aria-busy="true"/)
  assert.match(routeSkeletonSource, /aria-hidden="true"/)
  assert.match(routeSkeletonSource, /prefers-reduced-motion: reduce/)
  assert.match(routeSkeletonSource, /tb-route-skeleton__status-row/)
  assert.match(routeSkeletonSource, /tb-route-skeleton__table-row/)
  assert.match(routeSkeletonSource, /tb-route-skeleton__qr-picker/)
  assert.match(routeSkeletonSource, /tb-route-skeleton__qr-canvas/)
  assert.match(routeSkeletonSource, /tb-route-skeleton__properties/)
  assert.match(routeSkeletonSource, /@media \(max-width: 900px\)/)
  assert.doesNotMatch(routeSkeletonSource, /<(?:button|a|input|select)\b/)
  assert.match(routeSkeletonSource, /tb-route-skeleton__mobile-actions/)
  assert.match(routeSkeletonSource, /tb-route-skeleton__qr-taskbar/)
  assert.match(routeSkeletonSource, /@media \(max-width: 360px\)/)
  assert.ok(routeSkeletonSource.split('\n').length <= 380)
})

test('QR token rotation command stays behind its controller and dialog boundary', () => {
  assert.match(shellSource, /useTableQrTokenRotation/)
  assert.match(shellSource, /<TablesQRRotationDialog/)
  assert.doesNotMatch(shellSource, /rotateTableQrToken|window\.confirm|handleRotateToken/)
  assert.match(rotationSource, /rotateTableQrToken/)
  assert.match(rotationSource, /replaceTableQrToken/)
  assert.match(rotationSource, /if \(!target \|\| rotating \|\| !requestId\) return/)
  assert.match(rotationSource, /crypto\.randomUUID\(\)/)
  assert.doesNotMatch(rotationSource, /createClient|supabase|useTablesLiveState|useQRStyleEditor/i)
  assert.match(rotationDialogSource, /<AlertDialog open/)
  assert.match(rotationDialogSource, /<AlertDialogContent/)
  assert.match(rotationDialogSource, /<AlertDialogAction[^>]*variant="destructive"/)
  assert.doesNotMatch(rotationDialogSource, /lib\/actions|createClient|supabase|restaurantId|rotateTableQrToken/i)
})

test('transfer undo never accepts a client-selected permission', () => {
  assert.doesNotMatch(transferDialogSource, /requiredPermission/)
  assert.doesNotMatch(tableActionsSource, /requiredPermission/)
  assert.match(transferDialogSource, /undoTransfer\(\{ restaurantId, operationId: item\.id \}\)/)
  assert.match(tableActionsSource, /assertMember\(parsed\.data\.restaurantId\)/)
  assert.match(tableActionsSource, /permissions: access\.permissions/)
})

test('transfer completion feedback undoes its exact operation without opening generic history', () => {
  assert.match(operationsShellSource, /transferFeedback\.notifyCompleted\(operationId\)/)
  assert.match(operationsShellSource, /<TableTransferFeedback feedback=\{transferFeedback\.feedback\}/)
  assert.doesNotMatch(operationsShellSource, /setTransfer\(\{mode:'history',tableId:null\}\).*Geri al/)
  assert.match(transferFeedbackSource, /undoTransfer\(\{ restaurantId, operationId \}\)/)
  assert.match(transferFeedbackSource, /current\?\.operationId === operationId/)
})

test('transfer history renders explicit loading, empty and recoverable error states', () => {
  assert.match(transferDialogSource, /<TableTransferHistory/)
  assert.match(transferHistorySource, /Taşıma geçmişi yükleniyor…/)
  assert.match(transferHistorySource, /Henüz taşıma yok/)
  assert.match(transferHistorySource, /İlk masa veya hesap taşımanız tamamlandığında burada görünecek\./)
  assert.match(transferDialogSource, /setHistoryReloadKey/)
  assert.match(transferDialogSource, /Taşımanın sonucu doğrulanamadı\./)
})

test('transfer history delegates filters and exposes privacy-safe audit metadata', () => {
  assert.match(transferHistorySource, /filterTransferHistory/)
  assert.match(transferHistorySource, /Taşıma geçmişinde ara/)
  assert.match(transferHistorySource, /Taşıma türü filtresi/)
  assert.match(transferHistorySource, /Taşıma durumu filtresi/)
  assert.match(transferHistorySource, /Audit ayrıntıları/)
  assert.match(transferHistorySource, /item\.actorLabel/)
  assert.match(transferHistorySource, /item\.requestId/)
  assert.match(transferHistoryModelSource, /transferSessionOutcome/)
  assert.doesNotMatch(`${transferHistorySource}\n${transferHistoryModelSource}`, /lib\/actions|createClient|supabase/i)
  assert.ok(transferHistorySource.split('\n').length <= 260)
  assert.ok(transferHistoryModelSource.split('\n').length <= 120)
})

test('tables realtime authenticates once and consumes one narrow operational invalidation row', () => {
  assert.match(realtimeChannelHookSource, /import\('\.\/tables-realtime-channel-runtime'\)/)
  assert.match(realtimeChannelSource, /supabase\.auth\.getSession\(\)/)
  assert.match(realtimeChannelSource, /supabase\.realtime\.setAuth\(data\.session\.access_token\)/)
  assert.match(realtimeChannelSource, /supabase\.auth\.onAuthStateChange/)
  assert.equal((realtimeChannelSource.match(/\.channel\(`/g) ?? []).length, 1)
  assert.match(realtimeChannelSource, /channel\(`tables-live:/)
  assert.match(realtimeChannelSource, /table: 'pano_invalidations'/)
  assert.match(realtimeChannelSource, /scheduleInvalidation/)
  for (const table of ['table_sessions', 'orders', 'payment_shares', 'service_requests', 'tables']) assert.match(realtimeChannelSource, new RegExp(`source === '${table}'`))
  assert.doesNotMatch(realtimeChannelSource, /table: '(?:table_sessions|orders|payment_shares|service_requests|tables)'/)
  assert.match(liveStateSource, /Promise\.all\(\[\s*refreshSessions\(\),\s*refreshPendingRequests\(\),\s*refreshTableDirectory\(\)/)
  assert.match(liveStateSource, /setLayoutInvalidation/)
})

test('tables realtime exposes recovery state and cleans every listener', () => {
  assert.match(realtimeChannelSource, /TABLES_REALTIME_SAFETY_INTERVAL_MS/)
  assert.match(realtimeChannelSource, /consecutiveSafetyFailures >= 2 \? 'stale'/)
  assert.match(realtimeChannelSource, /status === 'CHANNEL_ERROR' \|\| status === 'TIMED_OUT'/)
  assert.match(realtimeChannelSource, /document\.addEventListener\('visibilitychange'/)
  assert.match(realtimeChannelSource, /window\.addEventListener\('online'/)
  assert.match(realtimeChannelSource, /window\.addEventListener\('offline'/)
  assert.match(realtimeChannelSource, /authListener\.subscription\.unsubscribe\(\)/)
  assert.match(realtimeChannelSource, /supabase\.removeChannel\(channel\)/)
  assert.match(liveStateSource, /retrySessions/)
  assert.match(liveStateSource, /retryPendingRequests/)
  assert.match(liveStateSource, /Servis isteği tamamlandı\./)
  assert.match(navigationHeaderSource, /İstek listesini yenile/)
  assert.match(navigationHeaderSource, /Masa durumunu yeniden dene/)
})

test('legacy layout import is explicit, sanitized and reuses the atomic server save', () => {
  assert.match(legacyLayoutModelSource, /garsonless-floor:/)
  assert.match(legacyLayoutModelSource, /knownTables\.get\(tableId\)/)
  assert.match(floorLayoutExternalSyncSource, /snapshot\.initializedAt/)
  assert.match(floorLayoutExternalSyncSource, /saveTableLayout/)
  assert.match(floorLayoutExternalSyncSource, /legacyRequestId\.current/)
  assert.doesNotMatch(floorLayoutExternalSyncSource, /removeItem|clear\(\)/)
})

test('pano routes to the canonical server layout and floor cards are memoized', () => {
  assert.match(panoAttentionTablesSource, /tables\?tableId=/)
  assert.doesNotMatch(panoClientSource, /overlays\/FloorPlan|garsonless-floor|localStorage/)
  assert.match(floorCardSource, /memo\(function TablesFloorCard/)
  assert.doesNotMatch(floorCanvasSource, /onSelect=\{\(\) =>|onMove=\{\(xBp/)
})

test('occupied floor cards keep operational details in a non-shrinking compact layout', () => {
  assert.match(floorCardSource, /<TableStatusBadge state=\{state\}/)
  assert.match(frameSource, /\.tb-floor-card__main \{[^}]*justify-content: flex-start/)
  assert.match(frameSource, /\.tb-floor-card__amount \{[^}]*font-variant-numeric: tabular-nums/)
  assert.match(frameSource, /\.tb-floor-card__footer \{[^}]*flex: none;[^}]*margin-top: auto/)
  // Small cards hide detail with container queries instead of shrinking type below a readable size.
  assert.match(frameSource, /@container \(max-height: 104px\) \{ \.tb-floor-card__meta \{ display: none; \} \}/)
})

test('tables navigation delegates projection and presentation to reviewable boundaries', () => {
  assert.match(navigationSource, /useTablesNavigationModel/)
  assert.match(navigationSource, /<TablesNavigationHeader/)
  assert.match(navigationSource, /<TablesNavigationFeedback/)
  assert.match(navigationSource, /<TablesNavigationFilters/)
  assert.match(navigationSource, /<TablesNavigationList/)
  assert.match(navigationSource, /<TablesResponsiveNavigation/)
  assert.match(navigationListSource, /<TablesNavigationTableRow/)
  assert.doesNotMatch(navigationSource, /useState|useEffect|useMemo|filterOperationalTables|tableOperationalState/)
  assert.doesNotMatch(`${navigationHeaderSource}\n${navigationFiltersSource}\n${navigationListSource}\n${navigationRowSource}`, /lib\/actions|createClient|supabase/i)
})

test('live tables composes shadcn controls without replacing spatial interactions', () => {
  assert.match(navigationHeaderSource, /from '@\/components\/ui\/alert'/)
  assert.match(navigationHeaderSource, /from '@\/components\/ui\/badge'/)
  assert.match(navigationFiltersSource, /from '@\/components\/ui\/input-group'/)
  assert.match(navigationFiltersSource, /aria-pressed=\{statusFilter === state\}/)
  // Empty, failed and no-match views share one presentation in the list and the plan.
  assert.match(navigationListSource, /<TablesFeedbackState/)
  assert.match(floorCanvasSource, /<TablesFeedbackState/)
  assert.match(navigationRowSource, /from '@\/components\/ui\/dropdown-menu'/)
  assert.match(navigationRowSource, /from '@\/components\/ui\/alert-dialog'/)
  assert.match(floorCanvasSource, /from '@\/components\/ui\/button'/)
  assert.match(floorCanvasSource, /from '@\/components\/ui\/native-select'/)
  assert.match(floorToolbarSource, /from '@\/components\/ui\/native-select'/)
  assert.match(transferDialogSource, /from '@\/components\/ui\/dialog'/)
  assert.match(transferDialogSource, /from '@\/components\/ui\/select'/)
  assert.match(transferOrderSelectorSource, /from '@\/components\/ui\/checkbox'/)
  assert.match(floorCardSource, /dragRef/)
  assert.match(floorCardSource, /onPointerMove/)
  assert.match(quickActionMenuSource, /createPortal/)
})

test('responsive navigation owns mobile filter and list dialogs without infrastructure access', () => {
  assert.match(responsiveNavigationSource, /<AccessibleDialog/)
  assert.match(responsiveNavigationSource, /Masa listesi/)
  assert.match(responsiveNavigationSource, /Filtreler/)
  assert.match(responsiveNavigationSource, /Sonuçları göster/)
  assert.match(responsiveNavigationSource, /aria-haspopup="dialog"/)
  assert.doesNotMatch(responsiveNavigationSource, /lib\/actions|createClient|supabase/i)
})

test('tables navigation decomposition budgets prevent another monolithic shell', () => {
  const budgets = [
    ['TablesNavigation', navigationSource, 170],
    ['useTablesNavigationModel', navigationModelSource, 120],
    ['TablesNavigationHeader', navigationHeaderSource, 150],
    ['TablesNavigationFilters', navigationFiltersSource, 130],
    ['TablesNavigationList', navigationListSource, 230],
    ['TablesNavigationTableRow', navigationRowSource, 300],
    ['TablesResponsiveNavigation', responsiveNavigationSource, 120],
  ] as const
  for (const [name, source, budget] of budgets) {
    const lines = source.split('\n').length
    assert.ok(lines <= budget, `${name} grew to ${lines} lines`)
  }
})

test('route-specific table shells stay below their decomposition budgets', () => {
  const qrLineCount = shellSource.split('\n').length
  const operationsLineCount = operationsShellSource.split('\n').length
  assert.ok(qrLineCount <= 240, `TablesBuilderShell grew to ${qrLineCount} lines`)
  assert.ok(operationsLineCount <= 240, `TablesOperationsShell grew to ${operationsLineCount} lines`)
})
