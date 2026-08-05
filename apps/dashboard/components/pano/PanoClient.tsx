'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import PageTopBar from '../layout/PageTopBar'
import { I, S, Tag, btnPrimary } from '../../lib/ui'
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
} from '../../lib/queries/pano'
import type { Section } from '../../lib/auth/access'
import {
  PanoKpiCard,
  PanoAttentionQueue,
  PanoPeakHours,
  PanoSystemHealth,
  PanoTopItemsWidget,
} from './PanoOverviewWidgets'
import {
  getPanoGreeting,
  getPanoHealthChecks,
  getPanoKpiCards,
} from './pano-view-model'
import { withPanoConnectionAttention } from '../../lib/pano-attention-model'
import { usePanoSalesChart } from './use-pano-sales-chart'
import { usePanoLiveState } from './use-pano-live-state'
import { usePanoOrderApproval } from './use-pano-order-approval'

const NewOrderModal = dynamic(() => import('../overlays/NewOrderModal'), { ssr: false })
const PanoSalesChart = dynamic(() => import('./PanoSalesChart').then((module) => module.PanoSalesChart), {
  loading: () => <div role="status" aria-label="Tahsilat grafiği yükleniyor" style={{ minHeight: 320, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }} />,
})
const PanoActivityFeed = dynamic(() => import('./PanoActivityFeed').then((module) => module.PanoActivityFeed), {
  loading: () => <div role="status" aria-label="Canlı akış yükleniyor" style={{ minHeight: 320, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }} />,
})

interface Props {
  restaurantId: string
  restaurantName: string
  generatedAt: string
  timezone: string
  initialErrors: string[]
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
    },
    initialFeed: props.initialFeed,
    initialTableStatuses: props.tableStatuses,
  })
  const {
    kpis,
    orderSummary,
    attentionItems,
    hourlySales,
    topItems,
    heatmap,
    paymentStatus,
    pendingServiceRequests,
  } = snapshot
  const [clockNow, setClockNow] = useState(() => new Date(props.generatedAt))
  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])
  const greeting = getPanoGreeting(timezone, clockNow)

  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrderTableId, setNewOrderTableId] = useState<string | null>(null)

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
  const operationalAttention = withPanoConnectionAttention(attentionItems, realtime, snapshot.generatedAt)
    .map((item) => {
      const canOpen = item.kind === 'pending_order'
        ? can('orders')
        : item.kind === 'payment_configuration'
          ? isOwner
          : item.kind === 'connection' || can('tables')
      return canOpen ? item : { ...item, actionHref: undefined }
    })
  const lateTableCount = liveTableStatuses.filter((table) => table.status === 'late').length
  const operationTagTone = orderSummary.pending > 0 || lateTableCount > 0
    ? 'critical' as const
    : orderSummary.preparing > 0
      ? 'warning' as const
      : 'positive' as const
  const operationTagDot = operationTagTone === 'critical'
    ? 'var(--critical)'
    : operationTagTone === 'warning'
      ? 'var(--warning)'
      : 'var(--positive)'
  const healthChecks = getPanoHealthChecks({ paymentStatus, isOwner, realtime, updatedAt, lastOrderAt, now: clockNow })
  const salesChart = usePanoSalesChart({ restaurantId, initialHourly: hourlySales, timezone, now: clockNow })
  const { approvalStates, approveOrder } = usePanoOrderApproval({
    restaurantId,
    onApproved: updateFeedStatus,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanoStyles />
      <PageTopBar
        className="page-topbar--pano"
        restaurantName={restaurantName}
        title="Pano"
        tag={
          <span role="status" aria-live="polite">
            <Tag tone={operationTagTone}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: operationTagDot, animation: 'pulse-dot 2s infinite', display: 'inline-block' }} />
              <span className="pano-status-full">{orderSummary.pending} bekleyen · {orderSummary.preparing} hazırlanan · {lateTableCount} geciken masa</span>
              <span className="pano-status-compact">{orderSummary.pending} bek. · {orderSummary.preparing} haz. · {lateTableCount} gec.</span>
            </Tag>
          </span>
        }
        right={
          <>
            {/* Static "today" context — the Pano is a today's-operations view.
                Range exploration lives in the chart toggle + the Analytics page. */}
            <span className="pano-today"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', height: 30, borderRadius: 7,
                background: 'var(--surface-3)', fontSize: 11.5, color: 'var(--text-2)',
              }}
            >
              <I.clock size={12} />
              <span style={S.mono}>Bugün · {clockNow.toLocaleDateString('tr-TR', { timeZone: timezone, day: 'numeric', month: 'long' })}</span>
            </span>
            {can('orders') && (
              <button type="button" className="pano-action pano-action-primary" onClick={() => openNewOrder()} style={btnPrimary()}>
                <I.plus size={13} />Yeni sipariş
              </button>
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
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, background: 'var(--bg)', overscrollBehaviorY: 'contain' }}>
        <div className="pano-shell">

          {/* Greeting */}
          <div className="pano-greeting">
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>
                {greeting}
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, marginBottom: 0 }}>
                {restaurantName} — son güncelleme{' '}
                <span style={{ ...S.mono, color: 'var(--text-3)' }}>
                  {updatedAt.toLocaleTimeString('tr-TR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            </div>
          </div>

          {snapshot.errors.length > 0 && (
            <div role="alert" style={{ marginBottom: 16, padding: '11px 13px', borderRadius: 10, border: '1px solid var(--critical)', background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 12 }}>
              Bazı Pano verileri alınamadı. Son başarılı değerler gösteriliyor.
              <button type="button" className="pano-data-toggle" disabled={refreshing} onClick={() => void retryLive()} style={{ marginLeft: 8, color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: refreshing ? 'wait' : 'pointer' }}>{refreshing ? 'Yenileniyor…' : 'Yeniden dene'}</button>
            </div>
          )}

          <div className="pano-attention">
            <PanoAttentionQueue items={operationalAttention} />
          </div>

          <div className="pano-kpis">
            {kpiCards.map((card) => <PanoKpiCard key={card.label} model={card} />)}
          </div>

          <div className="pano-wide-grid" style={{ marginBottom: 24 }}>
            <PanoAttentionTables
              restaurantId={restaurantId}
              tables={liveTableStatuses}
              serviceRequests={pendingServiceRequests}
              canViewTables={can('tables')}
            />
            <PanoSystemHealth checks={healthChecks} onRetry={() => void retryLive()} retrying={refreshing} />
          </div>

          <details className="pano-analytics" open>
            <summary className="pano-analytics-summary">
              <span>
                <strong style={{ display: 'block', fontSize: 15, color: 'var(--text)' }}>Analitik görünüm</strong>
                <span style={{ display: 'block', marginTop: 3, fontSize: 11.5, color: 'var(--text-3)' }}>Tahsilat, ürün ve yoğunluk eğilimleri</span>
              </span>
            </summary>
            <div className="pano-main-grid">
              <PanoSalesChart {...salesChart} timezone={timezone} now={clockNow} />
              <PanoActivityFeed
                feed={feed}
                canManageOrders={can('orders')}
                approvalStates={approvalStates}
                onApproveOrder={approveOrder}
                now={clockNow}
              />
            </div>
            <div className="pano-lower-grid">
              <PanoTopItemsWidget items={topItems} />
              <PanoPeakHours heatmap={heatmap} />
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
