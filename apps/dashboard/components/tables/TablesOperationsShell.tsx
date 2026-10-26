'use client'
import dynamic from 'next/dynamic'
import { startOfRestaurantDay } from '@garsonless/db/browser'
import { useMemo, useState } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import type { TableStatusData } from '../../lib/queries/pano'
import { useShell } from '../../lib/shell-context'
import { AccessibleDialog } from './AccessibleDialog'
import { mapDBTables } from './tables-builder-model'
import type { TableItem } from './tables-builder-types'
import { TablesNavigation } from './TablesNavigation'
import { TablesActionFailureToast, TablesRealtimeIndicator, TablesSyncNotice } from './TablesNavigationHeader'
import { TABLES_SHELL_CSS, TablesIconRail, TablesOperationsTopBar, TablesSectionTabs } from './TablesShellFrame'
import { TableTransferFeedback } from './TableTransferFeedback'
import { useTableTransferFeedback } from './use-table-transfer-feedback'
import { useTablesLiveState } from './use-tables-live-state'
import { tableOperationalState } from './tables-operation-model'
import { useOperationalNow } from './use-tables-navigation-model'
import type { TablesOperationsShellProps } from './tables-operations-ui-types'
import { useTableOperationPrefetch } from './use-transfer-orders-prefetch'
function DeferredDialogLoading() {
  return (
    <AccessibleDialog labelledBy="operations-dialog-loading-title" onClose={() => undefined} closeDisabled style={{ position: 'fixed', inset: 0, zIndex: 179, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.28)' }}>
      <span id="operations-dialog-loading-title" role="status" aria-live="polite" style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)', fontWeight: 650 }}>Pencere hazırlanıyor…</span>
    </AccessibleDialog>
  )
}
const SettlementSheet = dynamic(() => import('./SettlementSheet'), {
  ssr: false,
  loading: DeferredDialogLoading,
})
const TableTransferDialog = dynamic(() => import('./TableTransferDialog'), {
  ssr: false,
  loading: DeferredDialogLoading,
})
const TableDetailSurface = dynamic(() => import('./TableDetailSurface'), { ssr: false })
const NewOrderModal = dynamic(() => import('../overlays/NewOrderModal'), {
  ssr: false,
  loading: DeferredDialogLoading,
})
export default function TablesOperationsShell({
  restaurantId,
  restaurantName,
  restaurantTimezone = 'Europe/Istanbul',
  initialTables, initialDirectoryError = null, initialDirectoryErrorCode = null,
  initialOpenSessions, initialSessionError = null,
  initialLayoutSnapshot,
  initialLayoutError = null,
  initialNow,
  initialTableId = null,
}: TablesOperationsShellProps) {
  const [tables, setTables] = useState<TableItem[]>(() => mapDBTables(initialTables, initialOpenSessions, {}))
  const safeInitialTableId = initialTableId && tables.some((table) => table.id === initialTableId) ? initialTableId : null
  const [activeId, setActiveId] = useState(() => safeInitialTableId ?? tables[0]?.id ?? '')
  const [detailTableId, setDetailTableId] = useState<string | null>(() => safeInitialTableId)
  const [newOrderTableId, setNewOrderTableId] = useState<string | null | undefined>(undefined)
  const { navigation } = useShell()
  const canCreateOrders = navigation.isOwner || navigation.permissions.includes('orders')
  const now = useOperationalNow(initialNow)
  const [transfer, setTransfer] = useState<{
    mode: 'table_move' | 'account_transfer' | 'history'
    tableId: string | null
    initialOrderIds?: string[]
    selectAllInitially?: boolean
  } | null>(null)
  const {
    openSessions: rawOpenSessions, sessionError, refreshSessions,
    settlementTarget, dismissSettlement, requestSessionClose, startSettlement,
    pendingRequests, requestError, resolveRequest, feedbackNotice, dismissFeedbackNotice,
    sessionRetrying, requestRetrying, retrySessions, retryPendingRequests,
    connectionStatus, retryRealtime, layoutInvalidation, actionFailure, dismissActionFailure,
  } = useTablesLiveState({
    restaurantId,
    initialOpenSessions,
    initialSessionError,
    initialDirectoryError,
    setTables,
  })
  const restaurantDayStart = startOfRestaurantDay(restaurantTimezone, new Date(now)).getTime()
  const openSessions = useMemo(() => Object.fromEntries(Object.entries(rawOpenSessions).map(([id, session]) => [id, { ...session, restaurantDayStart }])), [rawOpenSessions, restaurantDayStart])
  const transferFeedback = useTableTransferFeedback({
    restaurantId,
    onChanged: refreshSessions,
  })
  const { openTableDetail, prefetchOperations } = useTableOperationPrefetch({ restaurantId, openSessions, setDetailTableId })
  const detailTable = detailTableId ? tables.find((table) => table.id === detailTableId) ?? null : null
  const startNewOrder = (tableId: string | null) => { setDetailTableId(null); setNewOrderTableId(tableId) }
  const tableStatuses = useMemo<TableStatusData[]>(() => tables.map((table) => {
    const session = openSessions[table.id]
    if (!session) return {
      id: table.id, label: table.label, status: 'empty', time: 0, total: 0,
      sessionId: null, openedAt: null, unpaidTotal: 0, splitSettledTotal: 0,
      splitDeclaredCashTotal: 0, orderCount: 0, hasUnfinished: false,
    }
    const state = tableOperationalState(session, now)
    return {
      id: table.id,
      label: table.label,
      status: state === 'open' ? 'active' : state,
      time: Math.max(0, Math.floor((now - new Date(session.openedAt).getTime()) / 60_000)),
      total: session.total,
      sessionId: session.sessionId,
      openedAt: session.openedAt,
      unpaidTotal: session.unpaidTotal,
      splitSettledTotal: session.splitSettledTotal,
      splitDeclaredCashTotal: session.splitDeclaredCashTotal,
      orderCount: session.orderCount,
      hasUnfinished: session.hasUnfinished,
    }
  }), [now, openSessions, tables])
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TABLES_SHELL_CSS }} />
      <div className="tb-tables tb-tables--operations" data-sync={connectionStatus === 'offline' || connectionStatus === 'stale' ? 'down' : 'live'} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <TablesOperationsTopBar restaurantName={restaurantName} status={<TablesRealtimeIndicator connectionStatus={connectionStatus} onRetry={retryRealtime} />} />
        <div className="tb-tables__body">
          <TablesIconRail restaurantId={restaurantId} />
          <div className="tb-tables__content">
            <TablesSectionTabs restaurantId={restaurantId} active="operations" actions={<button type="button" className="tb-tables__section-action" onClick={() => setTransfer({ mode: 'history', tableId: null })}><AppIcons.history size={15} />Taşıma geçmişi</button>} />
            <TablesSyncNotice connectionStatus={connectionStatus} onRetry={retryRealtime} />
            <main className="tb-tables__operations-main" aria-label="Canlı masa operasyonları">
            <TablesNavigation
              tables={tables}
              setTables={setTables}
              activeId={activeId}
              setActiveId={setActiveId}
              restaurantId={restaurantId}
              openSessions={openSessions}
              onCloseSession={requestSessionClose}
              onSettle={startSettlement}
              onTransfer={(mode, tableId, options) => setTransfer({ mode, tableId: tableId ?? null, selectAllInitially: options?.selectAll })}
              onPrefetchTransfer={prefetchOperations}
              onOpenDetail={openTableDetail}
              onNewOrder={startNewOrder}
              pendingRequests={pendingRequests}
              onResolveRequest={resolveRequest}
              requestError={requestError}
              sessionError={sessionError}
              feedbackNotice={feedbackNotice}
              onDismissFeedbackNotice={dismissFeedbackNotice}
              requestRetrying={requestRetrying}
              sessionRetrying={sessionRetrying}
              onRetryPendingRequests={retryPendingRequests}
              onRetrySessions={retrySessions}
              now={now}
              initialLayoutSnapshot={initialLayoutSnapshot}
              initialLayoutError={initialLayoutError}
              layoutInvalidation={layoutInvalidation}
              canCreateOrders={canCreateOrders} loadFailure={initialDirectoryError ? { message: initialDirectoryError, code: initialDirectoryErrorCode } : null}
              renderDetailPanel={(manage) => detailTable ? <TableDetailSurface
                restaurantId={restaurantId}
                table={detailTable}
                session={openSessions[detailTable.id]}
                pendingRequests={pendingRequests[detailTable.id] ?? []}
                now={now}
                canCreateOrders={canCreateOrders}
                onClose={() => setDetailTableId(null)}
                onNewOrder={() => startNewOrder(detailTable.id)}
                onTransferOrders={(orderIds) => {
                  setTransfer({ mode: 'account_transfer', tableId: detailTable.id, initialOrderIds: orderIds })
                  setDetailTableId(null)
                }}
                onTransferAll={() => {
                  setTransfer({ mode: 'account_transfer', tableId: detailTable.id, selectAllInitially: true })
                  setDetailTableId(null)
                }}
                onSettle={() => {
                  const session = openSessions[detailTable.id]
                  if (session) startSettlement(session, detailTable.label)
                  setDetailTableId(null)
                }}
                onCloseSession={() => {
                  const session = openSessions[detailTable.id]
                  if (session) void requestSessionClose(session, detailTable.label)
                  setDetailTableId(null)
                }}
                onResolveRequest={resolveRequest} onRename={(input) => manage.rename(detailTable, input)} onDelete={() => manage.remove(detailTable)}
              /> : null}
            />
            </main>
          </div>
        </div>
        {settlementTarget && (
          <SettlementSheet
            restaurantId={restaurantId}
            session={settlementTarget.session}
            tableLabel={settlementTarget.label}
            onClose={dismissSettlement}
            onSettled={() => { void refreshSessions() }}
            onSessionClosed={() => { dismissSettlement(); void refreshSessions() }}
          />
        )}
        {transfer && (
          <TableTransferDialog
            open
            mode={transfer.mode}
            sourceTableId={transfer.tableId}
            restaurantId={restaurantId}
            tables={tables}
            sessions={openSessions}
            initialOrderIds={transfer.initialOrderIds}
            selectAllInitially={transfer.selectAllInitially}
            onClose={() => setTransfer(null)}
            onChanged={(operationId) => {
              if (operationId) transferFeedback.notifyCompleted(operationId)
              void refreshSessions()
            }}
          />
        )}
        {newOrderTableId !== undefined && (
          <NewOrderModal
            restaurantId={restaurantId}
            tableStatuses={tableStatuses}
            initialTableId={newOrderTableId}
            onClose={() => setNewOrderTableId(undefined)}
            onCreated={() => { void refreshSessions() }}
          />
        )}
        <TablesActionFailureToast failure={actionFailure} onDismiss={dismissActionFailure} />
        <TableTransferFeedback feedback={transferFeedback.feedback} onUndo={() => { void transferFeedback.undo() }} onDismiss={transferFeedback.dismiss} />
      </div>
    </>
  )
}
