'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import PageTopBar from '../layout/PageTopBar'
import { I, S, Tag, btnPrimary } from '../../lib/ui'
import NewOrderModal from '../overlays/NewOrderModal'
import TableStatusExperience from './TableStatusExperience'
import type {
  DashboardKPIs,
  HourlySale,
  ActivityEvent,
  TopItem,
  TableStatusData,
  HeatmapCell,
  PaymentStatus,
} from '../../lib/queries/pano'
import type { Section } from '../../lib/auth/access'
import {
  PanoKpiCard,
  PanoPeakHours,
  PanoQuickActions,
  PanoSystemHealth,
  PanoTopItemsWidget,
} from './PanoOverviewWidgets'
import {
  getPanoGreeting,
  getPanoHealthChecks,
  getPanoKpiCards,
  getPanoQuickActions,
} from './pano-view-model'
import { PanoSalesChart } from './PanoSalesChart'
import { usePanoSalesChart } from './use-pano-sales-chart'
import { PanoActivityFeed } from './PanoActivityFeed'
import { usePanoLiveState } from './use-pano-live-state'
import { usePanoOrderApproval } from './use-pano-order-approval'

const FloorPlan = dynamic(() => import('../overlays/FloorPlan'))

interface Props {
  restaurantId: string
  restaurantName: string
  timezone: string
  initialErrors: string[]
  permissions: Section[]
  kpis: DashboardKPIs
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
  heatmap: HeatmapCell[]
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
    refreshSnapshot,
    refreshTables,
    updateFeedStatus,
  } = usePanoLiveState({
    restaurantId,
    initialSnapshot: {
      kpis: props.kpis,
      hourlySales: props.hourlySales,
      topItems: props.topItems,
      heatmap: props.heatmap,
      paymentStatus: props.paymentStatus,
      errors: props.initialErrors,
    },
    initialFeed: props.initialFeed,
    initialTableStatuses: props.tableStatuses,
  })
  const { kpis, hourlySales, topItems, heatmap, paymentStatus } = snapshot
  const greeting = getPanoGreeting(timezone)

  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrderTableId, setNewOrderTableId] = useState<string | null>(null)
  const [showFloorPlan, setShowFloorPlan] = useState(false)

  const openNewOrder = useCallback((tableId: string | null = null) => {
    setNewOrderTableId(tableId)
    setShowNewOrder(true)
  }, [])

  const lastOrderAt = feed[0]?.createdAt ?? null

  const kpiCards = getPanoKpiCards(kpis, restaurantId)
  const quickActions = getPanoQuickActions(restaurantId, props.permissions, isOwner)
  const healthChecks = getPanoHealthChecks({ paymentStatus, isOwner, realtime, lastOrderAt })
  const salesChart = usePanoSalesChart({ restaurantId, initialHourly: hourlySales, timezone })
  const { approvalStates, approveOrder } = usePanoOrderApproval({
    restaurantId,
    onApproved: updateFeedStatus,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .pano-shell { max-width: 1280px; margin: 0 auto; padding: 28px 32px 60px; }
        .pano-greeting { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
        .pano-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
        .pano-main-grid, .pano-wide-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 12px; margin-bottom: 12px; }
        .pano-lower-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
        .pano-wide-grid { margin-bottom: 0; }
        .pano-heatmap-scroll { min-width: 0; overflow-x: auto; padding-bottom: 2px; }
        .pano-action, .pano-quick-action, .pano-range-action {
          transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease, opacity 140ms ease;
        }
        .pano-action:hover { transform: translateY(-1px); box-shadow: var(--shadow-2); }
        .pano-action-primary:hover { filter: brightness(1.15); }
        .pano-action-secondary:hover { background: var(--surface-2) !important; border-color: var(--border-strong) !important; }
        .pano-quick-action:hover { background: var(--surface-3) !important; transform: translateX(2px); }
        .pano-quick-action:hover .pano-quick-icon { background: var(--surface) !important; color: var(--text) !important; box-shadow: var(--shadow-1); }
        .pano-kpi-link > div:hover { transform: translateY(-1px); box-shadow: var(--shadow-2); border-color: var(--border-strong) !important; }
        .pano-kpi-link:focus-visible { outline: 2px solid var(--focus-ring, var(--text)); outline-offset: 2px; border-radius: 12px; }
        .pano-range-action:not(:disabled):hover { background: var(--surface-2) !important; color: var(--text) !important; }
        .pano-action:focus-visible, .pano-quick-action:focus-visible, .pano-range-action:focus-visible {
          outline: 2px solid var(--focus-ring, var(--text)); outline-offset: 2px;
        }
        .pano-action:active, .pano-quick-action:active { transform: translateY(0) scale(.98); box-shadow: none; }
        @media (max-width: 1100px) {
          .pano-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pano-main-grid, .pano-wide-grid { grid-template-columns: minmax(0, 1fr); }
          .pano-lower-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .pano-shell { padding: 20px 16px 48px; }
          .pano-greeting { align-items: flex-start; flex-direction: column; }
          .pano-greeting-actions { width: 100%; flex-wrap: wrap; }
          .pano-kpis, .pano-lower-grid { grid-template-columns: minmax(0, 1fr); }
          .pano-chart-head { align-items: flex-start !important; flex-wrap: wrap; }
          .pano-chart-ranges { width: 100%; margin-left: 0 !important; }
          .pano-chart-ranges button { flex: 1; }
        }
      `}</style>
      <PageTopBar
        restaurantName={restaurantName}
        title="Pano"
        tag={
          <Tag tone="positive">
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)', animation: 'pulse-dot 2s infinite', display: 'inline-block' }} />
            Açık · {kpis.activeOrders} aktif sipariş
          </Tag>
        }
        right={
          <>
            {/* Static "today" context — the Pano is a today's-operations view.
                Range exploration lives in the chart toggle + the Analytics page. */}
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', height: 30, borderRadius: 7,
                background: 'var(--surface-3)', fontSize: 11.5, color: 'var(--text-2)',
              }}
            >
              <I.clock size={12} />
              <span style={S.mono}>Bugün · {new Date().toLocaleDateString('tr-TR', { timeZone: timezone, day: 'numeric', month: 'long' })}</span>
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
          onCreated={() => void refreshTables()}
        />
      )}
      {showFloorPlan && (
        <FloorPlan
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          tableStatuses={liveTableStatuses}
          onClose={() => setShowFloorPlan(false)}
          onNewOrder={(tableId) => {
            setShowFloorPlan(false)
            openNewOrder(tableId)
          }}
          onRefresh={() => void refreshTables()}
          canCreateOrders={can('orders')}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, background: 'var(--bg)' }}>
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
            <div className="pano-greeting-actions" style={{ display: 'flex', gap: 6 }}>
              {can('analytics') && <Link
                className="pano-action pano-action-secondary"
                href={`/dashboard/${restaurantId}/analytics`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', textDecoration: 'none',
                }}
              >
                <I.chart size={13} /> Raporlar
              </Link>}
              {can('menu') && <Link
                className="pano-action pano-action-primary"
                href={`/dashboard/${restaurantId}/menu`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                  background: 'var(--text)', color: '#fff', textDecoration: 'none',
                }}
              >
                <I.plus size={13} /> Menüye git
              </Link>}
            </div>
          </div>

          {snapshot.errors.length > 0 && (
            <div role="alert" style={{ marginBottom: 16, padding: '11px 13px', borderRadius: 10, border: '1px solid var(--critical)', background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 12 }}>
              Bazı Pano verileri alınamadı. Gösterilen değerlerin bir bölümü güncel olmayabilir.
              <button type="button" onClick={() => void refreshSnapshot()} style={{ marginLeft: 8, border: 0, padding: 0, background: 'transparent', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Yeniden dene</button>
            </div>
          )}

          {/* KPI Grid */}
          <div className="pano-kpis">
            {kpiCards.map((card) => <PanoKpiCard key={card.label} model={card} />)}
          </div>

          {/* Main grid */}
          <div className="pano-main-grid">
            <PanoSalesChart {...salesChart} timezone={timezone} />
            <PanoActivityFeed
              feed={feed}
              canManageOrders={can('orders')}
              approvalStates={approvalStates}
              onApproveOrder={approveOrder}
            />
          </div>

          <div className="pano-lower-grid">
            <PanoTopItemsWidget items={topItems} />
            <PanoPeakHours heatmap={heatmap} />
            <PanoQuickActions actions={quickActions} />
          </div>

          {/* Wide row */}
          <div className="pano-wide-grid">
            <TableStatusExperience
              restaurantId={restaurantId}
              tables={liveTableStatuses}
              onFloorPlan={() => setShowFloorPlan(true)}
              onNewOrder={openNewOrder}
              onRefresh={() => void refreshTables()}
              canViewDetails={can('tables')}
              canCreateOrders={can('orders')}
            />
            <PanoSystemHealth checks={healthChecks} />
          </div>
        </div>
      </div>
    </div>
  )
}
