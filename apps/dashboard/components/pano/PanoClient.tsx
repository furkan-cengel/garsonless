'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import PageTopBar from '../layout/PageTopBar'
import { I } from '../../lib/ui'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Spinner } from '@/components/ui/spinner'
import PanoAttentionTables from './PanoAttentionTables'
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
  PanoSnapshotHealth,
} from '../../lib/queries/pano'
import type { Section } from '../../lib/auth/access'
import { PanoKpiCard, PanoAttentionQueue, PanoPeakHours, PanoCardSkeleton, PanoSystemHealth, PanoTopItemsWidget, PanoSetupNotice } from './PanoOverviewWidgets'
import { getPanoGreeting, getPanoHealthChecks, getPanoKpiCards } from './pano-view-model'
import { getPanoAttentionTableCount, partitionPanoAttentionItems, withPanoConnectionAttention } from '../../lib/pano-attention-model'
import { usePanoSalesChart } from './use-pano-sales-chart'
import { usePanoLiveState } from './use-pano-live-state'
import { usePanoOrderApproval } from './use-pano-order-approval'

const NewOrderModal = dynamic(() => import('../overlays/NewOrderModal'), {
  ssr: false,
})
const PanoSalesChart = dynamic(() => import('./PanoSalesChart').then((module) => module.PanoSalesChart), {
  loading: () => <PanoCardSkeleton label="Tahsilat grafiği yükleniyor" />,
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
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
  heatmap: HeatmapCell[]
  pendingServiceRequests: PanoServiceRequest[]
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
      hourlySales: props.hourlySales,
      topItems: props.topItems,
      heatmap: props.heatmap,
      paymentStatus: props.paymentStatus,
      generatedAt: props.generatedAt,
      pendingServiceRequests: props.pendingServiceRequests,
      errors: props.initialErrors,
      health: props.initialHealth,
    },
    initialFeed: props.initialFeed,
    initialTableStatuses: props.tableStatuses,
  })
  const { kpis, orderSummary, attentionItems, hourlySales, topItems, heatmap, paymentStatus, pendingServiceRequests } = snapshot
  const greeting = getPanoGreeting(timezone, clockNow)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrderTableId, setNewOrderTableId] = useState<string | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(true)
  const openNewOrder = useCallback((tableId: string | null = null) => {
    setNewOrderTableId(tableId)
    setShowNewOrder(true)
  }, [])
  const lastOrderAt = feed[0]?.createdAt ?? null
  const kpiCards = getPanoKpiCards(kpis, restaurantId, {
    orderSummary,
    tables: liveTableStatuses,
    serviceRequests: pendingServiceRequests,
    canAnalytics: can('analytics'),
    canOrders: can('orders'),
    canTables: can('tables'),
  })
  const { operational: operationalAttention, setup: setupAttention } = partitionPanoAttentionItems(withPanoConnectionAttention(attentionItems, realtime, snapshot.generatedAt).map((item) => {
    const canOpen =
      item.kind === 'pending_order' ? can('orders') : item.kind === 'payment_configuration' ? isOwner : item.kind === 'connection' || can('tables')
    return canOpen ? item : { ...item, actionHref: undefined }
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
  const salesChart = usePanoSalesChart({
    restaurantId,
    initialHourly: hourlySales,
    timezone,
    now: clockNow,
  })
  const { approvalStates, approveOrder } = usePanoOrderApproval({
    restaurantId,
    onApproved: updateFeedStatus,
  })
  const canAnalytics = can('analytics')
  const attentionTableCount = getPanoAttentionTableCount(liveTableStatuses, pendingServiceRequests)
  const allClear = operationalAttention.length === 0 && attentionTableCount === 0
  const attention = allClear ? (
    <section id="pano-attention" aria-label="Dikkat gerekenler" className="pano-all-clear" role="status">
      <I.check aria-hidden="true" />
      <span><strong>Her şey yolunda.</strong> Bekleyen sipariş, geciken masa veya servis çağrısı yok.</span>
    </section>
  ) : (
    <div id="pano-attention" className="pano-wide-grid pano-attention-row">
      <PanoAttentionTables
        restaurantId={restaurantId}
        tables={liveTableStatuses}
        serviceRequests={pendingServiceRequests}
        canViewTables={can('tables')}
      />
      <PanoAttentionQueue items={operationalAttention} />
    </div>
  )
  const analytics = (
    <Collapsible className="pano-analytics" open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
      <CollapsibleTrigger className="pano-analytics-summary">
        <span>
          <strong style={{ display: 'block', fontSize: 15, color: 'var(--text)' }}>Analitik görünüm</strong>
          <span style={{ display: 'block', marginTop: 3, fontSize: 11.5, color: 'var(--text-3)' }}>Tahsilat, ürün ve yoğunluk eğilimleri</span>
        </span>
        <I.chevDown className="pano-analytics-chevron" data-open={analyticsOpen ? '' : undefined} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pano-main-grid">
          <PanoSalesChart {...salesChart} timezone={timezone} now={clockNow} />
          <PanoActivityFeed feed={feed} canManageOrders={can('orders')} approvalStates={approvalStates} onApproveOrder={approveOrder} now={clockNow} />
        </div>
        <div className="pano-lower-grid">
          <PanoTopItemsWidget items={topItems} />
          <PanoPeakHours heatmap={heatmap} />
        </div>
      </CollapsibleContent>
    </Collapsible>
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

          <div className="pano-kpis" data-count={kpiCards.length}>
            {kpiCards.map((card) => (
              <PanoKpiCard key={card.label} model={card} />
            ))}
          </div>

          {/* Owners open Pano for the business picture; staff for what needs doing now. */}
          {canAnalytics && analytics}
          {attention}
          {!canAnalytics && (
            <div className="pano-main-grid">
              <PanoActivityFeed feed={feed} canManageOrders={can('orders')} approvalStates={approvalStates} onApproveOrder={approveOrder} now={clockNow} />
              <PanoPeakHours heatmap={heatmap} />
            </div>
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
