'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import PageTopBar from '../layout/PageTopBar'
import { I } from '../../lib/ui'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import PanoStyles from './PanoStyles'
import type {
  DashboardKPIs,
  HourlySale,
  ActivityEvent,
  TopItem,
  TableStatusData,
  HeatmapCell,
  PaymentStatus,
  PanoAttentionItem,
  PanoOrderSummary,
  PanoServiceRequest,
  PanoActionableOrder,
  PanoSnapshotHealth,
} from '../../lib/queries/pano'
import type { Section } from '../../lib/auth/access'
import type { PanoBusinessSource, PanoStaffSource } from '@garsonless/application/read-models'
import { PanoCardSkeleton, PanoSystemHealth, PanoSetupNotice } from './PanoOverviewWidgets'
import { getPanoGreeting, getPanoHealthChecks } from './pano-view-model'
import { canOpenPanoAttentionItem, partitionPanoAttentionItems, withPanoConnectionAttention } from '../../lib/pano-attention-model'
import { isPanoView, PANO_VIEWS, usePanoView } from './use-pano-view'
import { buildPanoTasks, countTableStates } from './pano-shift-model'
import { PanoShiftView } from './PanoShiftView'
import { usePanoTaskActions } from './use-pano-task-actions'
import { restaurantHour } from '@garsonless/db/browser'
import { usePanoLiveState } from './use-pano-live-state'
import { usePanoOrderApproval } from './use-pano-order-approval'

const NewOrderModal = dynamic(() => import('../overlays/NewOrderModal'), {
  ssr: false,
})
const PanoBusinessView = dynamic(() => import('./PanoBusinessView').then((module) => module.PanoBusinessView), {
  loading: () => <PanoCardSkeleton label="İşletme özeti yükleniyor" />,
})
const PanoActivityFeed = dynamic(() => import('./PanoActivityFeed').then((module) => module.PanoActivityFeed), {
  loading: () => <PanoCardSkeleton label="Canlı akış yükleniyor" />,
})
interface Props {
  restaurantId: string
  restaurantName: string
  generatedAt: string
  timezone: string
  initialErrors: string[]
  initialHealth: PanoSnapshotHealth
  permissions: Section[]
  kpis: DashboardKPIs
  orderSummary: PanoOrderSummary
  attentionItems: PanoAttentionItem[]
  business: PanoBusinessSource | null
  till: PanoBusinessSource['today'] | null
  staff: PanoStaffSource | null
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
  heatmap: HeatmapCell[]
  pendingServiceRequests: PanoServiceRequest[]
  actionableOrders: PanoActionableOrder[]
  /** Owner-only; null for members (payment config is owner domain). */
  paymentStatus: PaymentStatus | null
  isOwner: boolean
}

export default function PanoClient(props: Props) {
  const { restaurantId, restaurantName, timezone, isOwner } = props
  const can = useCallback((section: Section) => isOwner || props.permissions.includes(section), [isOwner, props.permissions])
  const {
    snapshot,
    feed,
    tableStatuses: liveTableStatuses,
    realtime,
    updatedAt,
    refreshing,
    retainedData,
    now: clockNow,
    refreshSnapshot,
    retryLive,
    updateFeedStatus,
  } = usePanoLiveState({
    restaurantId,
    initialSnapshot: {
      kpis: props.kpis,
      orderSummary: props.orderSummary,
      attentionItems: props.attentionItems,
      business: props.business,
      till: props.till, staff: props.staff,
      hourlySales: props.hourlySales,
      topItems: props.topItems,
      heatmap: props.heatmap,
      paymentStatus: props.paymentStatus,
      generatedAt: props.generatedAt,
      pendingServiceRequests: props.pendingServiceRequests,
      actionableOrders: props.actionableOrders,
      errors: props.initialErrors,
      health: props.initialHealth,
    },
    initialFeed: props.initialFeed,
    initialTableStatuses: props.tableStatuses,
  })
  const { orderSummary, attentionItems, business, till, staff, topItems, heatmap, paymentStatus, pendingServiceRequests, actionableOrders } = snapshot
  const greeting = getPanoGreeting(timezone, clockNow)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrderTableId, setNewOrderTableId] = useState<string | null>(null)
  const canAnalytics = can('analytics')
  const { view, views, choose: chooseView } = usePanoView(restaurantId, { business: canAnalytics, shift: canAnalytics || can('cash') })
  const openNewOrder = useCallback((tableId: string | null = null) => {
    setNewOrderTableId(tableId)
    setShowNewOrder(true)
  }, [])
  const lastOrderAt = feed[0]?.createdAt ?? null
  const { operational: operationalAttention, setup: setupAttention } = partitionPanoAttentionItems(withPanoConnectionAttention(attentionItems, realtime, snapshot.generatedAt).map((item) => {
    return canOpenPanoAttentionItem(item.kind, can, isOwner) ? item : { ...item, actionHref: undefined }
  }))
  const lateTableCount = liveTableStatuses.filter((table) => table.status === 'late').length
  const operationTagTone =
    orderSummary.pending > 0 || lateTableCount > 0 ? ('critical' as const) : orderSummary.preparing > 0 ? ('warning' as const) : ('positive' as const)
  const operationBadgeVariant = operationTagTone === 'critical' ? ('destructive' as const) : operationTagTone
  const operationTagDot = operationTagTone === 'critical' ? 'var(--critical)' : operationTagTone === 'warning' ? 'var(--warning)' : 'var(--positive)'
  const healthChecks = getPanoHealthChecks({
    paymentStatus,
    isOwner,
    realtime,
    updatedAt,
    lastOrderAt,
    now: clockNow,
  })
  const { approvalStates, approveOrder } = usePanoOrderApproval({
    restaurantId,
    onApproved: updateFeedStatus,
  })
  const openTables = liveTableStatuses.filter((table) => table.sessionId !== null && table.unpaidTotal - table.splitSettledTotal > 0)
  const openAmount = openTables.reduce((sum, table) => sum + table.unpaidTotal - table.splitSettledTotal, 0)
  const taskActions = usePanoTaskActions({ restaurantId, approveOrder, onDone: () => void refreshSnapshot() })
  const tasks = buildPanoTasks({
    restaurantId,
    now: clockNow.getTime(),
    tables: liveTableStatuses,
    serviceRequests: pendingServiceRequests,
    orders: actionableOrders,
    notices: operationalAttention.filter((item) => item.kind === 'connection' || item.kind === 'customer_feedback'),
    // The service view is for the floor: work, not money.
    showMoney: view === 'shift',
    can: { orders: can('orders'), tables: can('tables') },
  }).filter((task) => !taskActions.hidden.has(task.id))
  const shiftView = (
    <PanoShiftView
      tasks={tasks}
      busyTaskId={taskActions.busy}
      message={taskActions.message}
      onDismissMessage={taskActions.dismissMessage}
      onRun={(task) => void taskActions.run(task)}
      kitchen={{ pending: orderSummary.pending, preparing: orderSummary.preparing, ready: actionableOrders.filter((order) => order.status === 'ready').length }}
      tableStates={countTableStates(liveTableStatuses)}
      till={view === 'shift' ? { today: till, openAmount, staff, timezone } : null}
      links={{ orders: can('orders') ? `/dashboard/${restaurantId}/orders` : null, tables: can('tables') ? `/dashboard/${restaurantId}/tables` : null }}
    />
  )
  const waiting = [
    orderSummary.pending > 0 && `${orderSummary.pending} sipariş onay bekliyor`,
    lateTableCount > 0 && `${lateTableCount} masa gecikiyor`,
    pendingServiceRequests.length > 0 && `${pendingServiceRequests.length} servis çağrısı`,
  ].filter(Boolean) as string[]
  const businessView = (
    <PanoBusinessView
      restaurantId={restaurantId}
      business={business}
      topItems={topItems}
      heatmap={heatmap}
      context={{
        weekday: clockNow.toLocaleDateString('tr-TR', { weekday: 'long', timeZone: timezone }),
        currentHour: restaurantHour(clockNow, timezone),
        openAmount,
        openTables: openTables.length,
      }}
      attention={{ count: orderSummary.pending + lateTableCount + pendingServiceRequests.length, text: waiting.join(' · '), onOpen: () => chooseView('shift') }}
      canInventory={can('inventory')}
      staff={staff} timezone={timezone}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanoStyles />
      <PageTopBar
        className="page-topbar--pano"
        restaurantName={restaurantName}
        title="Pano"
        tag={
          <span role="status" aria-live="polite">
            <Badge variant={operationBadgeVariant}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: operationTagDot,
                  animation: 'pulse-dot 2s infinite',
                  display: 'inline-block',
                }}
              />
              {/* Counts live in the KPI tiles and the attention block; the tag only says the mood. */}
              <span>{operationTagTone === 'critical' ? 'İşlem bekliyor' : operationTagTone === 'warning' ? 'Mutfak çalışıyor' : 'Sakin'}</span>
            </Badge>
          </span>
        }
        right={
          <>
            <Badge variant="secondary" className="pano-today pano-number h-8">
              <I.clock data-icon="inline-start" />
              <span>
                Bugün ·{' '}
                {clockNow.toLocaleDateString('tr-TR', {
                  timeZone: timezone,
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </Badge>
            {can('orders') && (
              <Button size="sm" className="pano-action-primary" onClick={() => openNewOrder()}>
                <I.plus data-icon="inline-start" />
                Yeni sipariş
              </Button>
            )}
          </>
        }
      />
      {showNewOrder && (
        <NewOrderModal
          restaurantId={restaurantId}
          tableStatuses={liveTableStatuses}
          initialTableId={newOrderTableId}
          onClose={() => {
            setShowNewOrder(false)
            setNewOrderTableId(null)
          }}
          onCreated={() => void refreshSnapshot()}
        />
      )}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minWidth: 0,
          background: 'var(--bg)',
          overscrollBehaviorY: 'contain',
        }}
      >
        <div className="pano-shell">
          <div className="pano-greeting">
            <div>
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: '-.02em',
                  margin: 0,
                  color: 'var(--text)',
                }}
              >
                {greeting}
              </h1>
              <p
                style={{
                  fontSize: 13.5,
                  color: 'var(--text-2)',
                  marginTop: 6,
                  marginBottom: 0,
                }}
              >
                {restaurantName} - son güncelleme{' '}
                <span className="pano-number" style={{ color: 'var(--text-3)' }}>
                  {updatedAt.toLocaleTimeString('tr-TR', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>
            </div>
            {views.length > 1 && (
              <ToggleGroup variant="outline" size="sm" aria-label="Görünüm" value={[view]} onValueChange={(values) => { if (isPanoView(values[0])) chooseView(values[0]) }}>
                {PANO_VIEWS.filter((option) => views.includes(option.value)).map((option) => <ToggleGroupItem key={option.value} value={option.value} className="aria-pressed:bg-foreground aria-pressed:text-background">{option.label}</ToggleGroupItem>)}
              </ToggleGroup>
            )}
          </div>

          {snapshot.errors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <I.warn />
              <AlertTitle>Bazı Pano verileri alınamadı</AlertTitle>
              <AlertDescription>{retainedData ? 'Güncellenemeyen bölümlerde son başarılı değerler korunuyor.' : 'Bazı değerler kullanılamıyor. Yeniden deneyin.'}</AlertDescription>
              <AlertAction>
                <Button variant="ghost" size="sm" disabled={refreshing} aria-busy={refreshing} onClick={() => void retryLive()}>
                  {refreshing && <Spinner data-icon="inline-start" aria-hidden="true" />}
                  {refreshing ? 'Yenileniyor…' : 'Yeniden dene'}
                </Button>
              </AlertAction>
            </Alert>
          )}

          {/* Owners open Pano for the business picture; staff for what needs doing now. */}
          {view === 'business' ? businessView : (
            <>
              {shiftView}
              <PanoActivityFeed feed={feed} canManageOrders={can('orders')} approvalStates={approvalStates} onApproveOrder={approveOrder} now={clockNow} />
            </>
          )}

          <div className="pano-footer-grid">
            <PanoSystemHealth checks={healthChecks} onRetry={() => void retryLive()} retrying={refreshing} />
            {isOwner && <PanoSetupNotice items={setupAttention} />}
          </div>
        </div>
      </div>
    </div>
  )
}
