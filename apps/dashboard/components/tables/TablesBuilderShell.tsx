'use client'

import { useState } from 'react'
import type { Tables } from '@garsonless/db/types'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import SettlementSheet from './SettlementSheet'
import { useShell } from '../../lib/shell-context'
import DashboardIconRail from '../layout/IconRail'
import { QRHealthDialog } from './QRHealthDialog'
import { mapDBTables, MENU_ORIGIN } from './tables-builder-model'
import type { TableItem } from './tables-builder-types'
import { TablesMobilePreview, TablesStatusBar, TablesTopBar } from './TablesBuilderChrome'
import { TablesNavigation } from './TablesNavigation'
import { TablesQRCanvas } from './TablesQRCanvas'
import { TablesQRProperties } from './TablesQRProperties'
import { TablesQRRotationDialog } from './TablesQRRotationDialog'
import { validateRenderedQR } from './tables-qr-renderer'
import { useQRStyleEditor } from './use-qr-style-editor'
import { useTableQrTokenRotation } from './use-table-qr-token-rotation'
import { useTablesLiveState } from './use-tables-live-state'

/* ─── Types ─────────────────────────────────────────────────── */
interface Props {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  initialTables: Tables<'tables'>[]
  initialQrTokens: Record<string, string>
  initialOpenSessions: OpenSessionInfo[]
  initialSessionError?: string | null
  initialQRStyle?: unknown
}

/* ─── Constants ─────────────────────────────────────────────── */
/* ─── CSS Design System ─────────────────────────────────────── */
const CSS_VARS = `
.tb-tables * { box-sizing: border-box; }
.tb-tables {
  --text-inv: var(--on-action);
  --action-hover: color-mix(in srgb, var(--action) 88%, white);
  --topbar: 52px;
  --rail: 56px;
  --nav: 260px;
  --props: 340px;
  --statusbar: 32px;
  font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.005em;
}
.tb-tables button { font-family: inherit; }
.tb-tables button:not(:disabled) { transition: filter 120ms ease, transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease, border-color 120ms ease; }
.tb-tables button:not(:disabled):hover { filter: brightness(.96); transform: translateY(-1px); }
.tb-tables button:not(:disabled):active { filter: brightness(.92); transform: translateY(0); }
.tb-tables button:focus-visible,
.tb-tables input:focus-visible,
.tb-tables select:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
.tb-tables button:disabled { cursor: not-allowed; }
.tb-tables input, .tb-tables select { font-family: inherit; }
.tb-tables ::-webkit-scrollbar { width: 10px; height: 10px; }
.tb-tables ::-webkit-scrollbar-track { background: transparent; }
.tb-tables ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; border: 2px solid var(--surface); }
.tb-tables ::-webkit-scrollbar-thumb:hover { background: var(--text-4); }
@media (max-width: 900px) {
  .tb-tables {
    --topbar: 52px;
    --rail: 0px;
    --nav: 100%;
    --props: 100%;
    min-height: 100vh;
    height: auto !important;
    overflow-x: clip;
  }
  .tb-tables__topbar {
    display: flex !important;
    height: auto !important;
    min-height: var(--topbar);
    padding: 8px 10px !important;
    gap: 8px;
  }
  .tb-tables__topbar-left {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
  }
  .tb-tables__topbar-left > a span,
  .tb-tables__topbar-left > button,
  .tb-tables__topbar-left > span:nth-of-type(1),
  .tb-tables__topbar-left > span:nth-of-type(2) {
    display: none !important;
  }
  .tb-tables__topbar-presets,
  .tb-tables__topbar-right {
    display: none !important;
  }
  .tb-tables__workspace {
    flex-direction: column;
    overflow: auto;
  }
  .tb-tables__rail {
    display: none !important;
  }
  .tb-tables__nav {
    width: 100% !important;
    flex: none !important;
    max-height: 420px;
    border-right: none !important;
    border-bottom: 1px solid var(--border);
  }
  .tb-tables__canvas {
    flex: none !important;
    min-height: 520px;
  }
  .tb-tables__canvas-toolbar {
    height: auto !important;
    min-height: 44px;
    position: sticky;
    top: 0;
    z-index: 12;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 10px !important;
    align-items: flex-start !important;
  }
  .tb-tables__canvas-toolbar-left,
  .tb-tables__canvas-toolbar-actions {
    flex: 1 1 100%;
    min-width: 0;
  }
  .tb-tables__canvas-toolbar-actions {
    justify-content: space-between;
    overflow-x: auto;
  }
  .tb-tables__canvas-body {
    padding: 20px !important;
  }
  .tb-tables__props {
    width: 100% !important;
    flex: none !important;
    border-left: none !important;
    border-top: 1px solid var(--border);
  }
  .tb-tables__props-tabs { position: sticky; top: 0; z-index: 10; background: var(--surface); }
  .tb-tables__statusbar {
    display: none !important;
  }
}
/* Hover/press affordance. Uses filter (never set inline) so it reliably layers
   over any inline background — inline styles otherwise win over CSS. */
.tb-tables .tb-hover { transition: filter .12s ease, opacity .12s ease; }
.tb-tables .tb-hover:hover:not(:disabled) { filter: brightness(0.93); }
.tb-tables .tb-hover:active:not(:disabled) { filter: brightness(0.84); }
.tb-tables .tb-hover:disabled { opacity: .4; cursor: not-allowed; }
`

/* ─── Shared icon aliases ───────────────────────────────────── */

/* ─── IconRail ──────────────────────────────────────────────── */
function TablesIconRail({ restaurantId }: { restaurantId: string }) {
  const { navigation } = useShell()
  return (
    <DashboardIconRail
      className="tb-tables__rail"
      restaurantId={restaurantId}
      userInitials={navigation.userInitials}
      pathname={navigation.pathname}
      ordersBadge={navigation.ordersBadge}
      permissions={navigation.permissions}
      isOwner={navigation.isOwner}
    />
  )
}

/* ─── PresetChip ────────────────────────────────────────────── */
export default function TablesBuilderShell({ restaurantId, restaurantName, restaurantSlug, initialTables, initialQrTokens, initialOpenSessions, initialSessionError = null, initialQRStyle }: Props) {
  const baseQRUrl = `${MENU_ORIGIN}/${restaurantSlug}`
  const [tables, setTables] = useState<TableItem[]>(() => mapDBTables(initialTables, initialOpenSessions, initialQrTokens))
  const [activeId, setActiveId] = useState<string>(() => {
    const mapped = mapDBTables(initialTables, initialOpenSessions, initialQrTokens)
    return mapped[0]?.id ?? ''
  })
  const activeTable = tables.find((table) => table.id === activeId)
  const {
    openSessions,
    sessionError,
    reportSessionError,
    refreshSessions,
    settlementTarget,
    dismissSettlement,
    requestSessionClose,
    pendingRequests,
    requestError,
    resolveRequest,
  } = useTablesLiveState({
    restaurantId,
    initialOpenSessions,
    initialSessionError,
    setTables,
  })
  const {
    qr,
    setQR,
    replaceQR,
    beginQRChange,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    saveError,
    persist: persistQR,
    health: qrHealth,
    healthDialogOpen,
    setHealthDialogOpen,
  } = useQRStyleEditor({
    restaurantId,
    baseUrl: baseQRUrl,
    initialStyle: initialQRStyle,
    activeTable,
    validate: validateRenderedQR,
  })
  const qrTokenRotation = useTableQrTokenRotation({
    restaurantId,
    setTables,
    onError: reportSessionError,
  })
  // Shopify-style in-app mobile preview (phone mockup) — null = closed.
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_VARS }} />
      <div className="tb-tables" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <TablesTopBar
          qr={qr}
          setQR={setQR}
          restaurantName={restaurantName}
          saveState={saveState}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onPreview={() => setPreview({
            src: qr.baseUrl,
            title: 'Menü önizleme',
          })}
        />
        <div className="tb-tables__workspace" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <TablesIconRail restaurantId={restaurantId} />
          <TablesNavigation tables={tables} setTables={setTables} activeId={activeId} setActiveId={setActiveId} restaurantId={restaurantId} openSessions={openSessions} onCloseSession={requestSessionClose} pendingRequests={pendingRequests} onResolveRequest={resolveRequest} requestError={requestError} sessionError={sessionError} />
          <TablesQRCanvas
            qr={qr}
            table={activeTable}
            tables={tables}
            health={qrHealth}
            rotationPending={qrTokenRotation.rotating}
            onRotateToken={qrTokenRotation.requestRotation}
          />
          <TablesQRProperties qr={qr} setQR={setQR} replaceQR={replaceQR} beginQRChange={beginQRChange} tables={tables} saveState={saveState} saveError={saveError} onRetry={() => { void persistQR(qr) }} />
        </div>
        <TablesStatusBar saveState={saveState} saveError={saveError} onRetry={() => { void persistQR(qr) }} tableCount={tables.length} activeCount={Object.keys(openSessions).length} />
        {settlementTarget && (
          <SettlementSheet
            restaurantId={restaurantId}
            session={settlementTarget.session}
            tableLabel={settlementTarget.label}
            onClose={dismissSettlement}
            onSettled={() => void refreshSessions()}
            onSessionClosed={() => { dismissSettlement(); void refreshSessions() }}
          />
        )}
        {preview && (
          <TablesMobilePreview src={preview.src} title={preview.title} onClose={() => setPreview(null)} />
        )}
        <QRHealthDialog
          open={healthDialogOpen}
          health={qrHealth}
          qr={qr}
          onClose={() => setHealthDialogOpen(false)}
        />
        <TablesQRRotationDialog
          table={qrTokenRotation.target}
          rotating={qrTokenRotation.rotating}
          error={qrTokenRotation.error}
          onCancel={qrTokenRotation.cancelRotation}
          onConfirm={() => { void qrTokenRotation.confirmRotation() }}
        />
      </div>
    </>
  )
}
