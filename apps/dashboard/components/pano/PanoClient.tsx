'use client'

import { Fragment, useCallback, useState, useEffect, useRef, useTransition, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import PageTopBar from '../layout/PageTopBar'
import { I, S, Tag, EmptyState, btnPrimary } from '../../lib/ui'
import NewOrderModal from '../overlays/NewOrderModal'
import TableStatusExperience from './TableStatusExperience'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { updateOrderStatus } from '../../lib/actions/orders'
import {
  fetchPanoChart,
  fetchPanoTableStatuses,
  type PanoChartData,
  type PanoChartPoint,
  type PanoChartRange,
} from '../../lib/actions/pano'
import type {
  DashboardKPIs,
  HourlySale,
  ActivityEvent,
  TopItem,
  TableStatusData,
  HeatmapCell,
  PaymentStatus,
} from '../../lib/queries'

type RealtimeStatus = 'connecting' | 'connected' | 'down'

const FloorPlan = dynamic(() => import('../overlays/FloorPlan'))

interface Props {
  restaurantId: string
  restaurantName: string
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

/** Client-side seed of the 'day' chart from the SSR hourly data (mirrors fetchPanoChart's day branch). */
function dayPointsFromHourly(hourly: HourlySale[]): PanoChartPoint[] {
  const currentHour = new Date().getHours()
  return hourly
    .filter((d) => d.hour >= 7 && d.hour <= 22)
    .map((d) => ({ label: String(d.hour).padStart(2, '0'), value: d.total, highlight: d.hour === currentHour }))
}

function pct(a: number, b: number): string {
  if (b === 0) return a > 0 ? '+100%' : '—'
  const d = Math.round(((a - b) / b) * 100)
  return d >= 0 ? `+${d}%` : `${d}%`
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'az önce'
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`
  return 'Dün'
}

export default function PanoClient({ restaurantId, restaurantName, kpis, hourlySales, initialFeed, topItems, tableStatuses, heatmap, paymentStatus, isOwner }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'

  const [showNewOrder, setShowNewOrder] = useState(false)
  const [newOrderTableId, setNewOrderTableId] = useState<string | null>(null)
  const [showFloorPlan, setShowFloorPlan] = useState(false)
  const [feed, setFeed] = useState<ActivityEvent[]>(initialFeed)
  const [realtime, setRealtime] = useState<RealtimeStatus>('connecting')
  const [liveTableStatuses, setLiveTableStatuses] = useState(tableStatuses)

  const refreshTables = useCallback(async () => {
    const result = await fetchPanoTableStatuses(restaurantId)
    if (!('error' in result)) setLiveTableStatuses(result.tables)
  }, [restaurantId])

  const openNewOrder = useCallback((tableId: string | null = null) => {
    setNewOrderTableId(tableId)
    setShowNewOrder(true)
  }, [])

  // Table id → label map (from the SSR table snapshot), kept current so realtime
  // new orders can show the real table label without an extra fetch.
  const labelByTableId = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    labelByTableId.current = new Map(liveTableStatuses.map(t => [t.id, t.label]))
  }, [liveTableStatuses])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    const channel = supabase
      .channel(`orders:${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, payload => {
        void refreshTables()
        const row = payload.new as { id: string; status: string; total: number; table_id: string | null; created_at: string }
        if (payload.eventType === 'UPDATE') {
          setFeed((previous) => previous.map((event) => (
            event.id === row.id ? { ...event, status: row.status } : event
          )))
          return
        }
        if (payload.eventType !== 'INSERT') return
        setFeed(prev => [
          {
            id: row.id, status: row.status, total: row.total, tableId: row.table_id,
            tableLabel: row.table_id ? labelByTableId.current.get(row.table_id) ?? null : null,
            createdAt: row.created_at,
          },
          ...prev,
        ].slice(0, 7))
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => {
        void refreshTables()
      })
      .subscribe(status => {
        // Real liveness signal for the system-health panel — this browser's channel state.
        setRealtime(
          status === 'SUBSCRIBED' ? 'connected'
          : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'down'
          : 'connecting',
        )
      })
    return () => { void supabase.removeChannel(channel) }
  }, [restaurantId, refreshTables])

  const lastOrderAt = feed[0]?.createdAt ?? null

  const avgBasketYesterday = kpis.paidOrdersYesterday > 0
    ? Math.round(kpis.revenueYesterday / kpis.paidOrdersYesterday)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              <span style={S.mono}>Bugün · {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span>
            </span>
            <button onClick={() => openNewOrder()} style={btnPrimary()}>
              <I.plus size={13} />Yeni sipariş
            </button>
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
        />
      )}

      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 60px' }}>

          {/* Greeting */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>
                {greeting}
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, marginBottom: 0 }}>
                {restaurantName} — son güncelleme{' '}
                <span style={{ ...S.mono, color: 'var(--text-3)' }}>
                  {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Link
                href={`/dashboard/${restaurantId}/analytics`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', textDecoration: 'none',
                }}
              >
                <I.chart size={13} /> Raporlar
              </Link>
              <Link
                href={`/dashboard/${restaurantId}/menu`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                  background: 'var(--text)', color: '#fff', textDecoration: 'none',
                }}
              >
                <I.plus size={13} /> Ürün ekle
              </Link>
            </div>
          </div>

          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KPICard
              label="Tahsil edilen ciro"
              value={`₺${kpis.revenue.toLocaleString('tr-TR')}`}
              delta={pct(kpis.revenue, kpis.revenueYesterday)}
              trend={kpis.revenue >= kpis.revenueYesterday ? 'up' : 'down'}
              sub={`vs. dün ₺${kpis.revenueYesterday.toLocaleString('tr-TR')}`}
              featured
              href={`/dashboard/${restaurantId}/analytics`}
            />
            <KPICard
              label="Sipariş hacmi"
              value={String(kpis.orders)}
              delta={kpis.orders - kpis.ordersYesterday >= 0 ? `+${kpis.orders - kpis.ordersYesterday}` : String(kpis.orders - kpis.ordersYesterday)}
              trend={kpis.orders >= kpis.ordersYesterday ? 'up' : 'down'}
              sub={`${kpis.activeOrders} hâlâ aktif`}
              href={`/dashboard/${restaurantId}/orders`}
            />
            <KPICard
              label="Ort. tahsilat"
              value={`₺${kpis.avgBasket}`}
              delta={pct(kpis.avgBasket, avgBasketYesterday)}
              trend={kpis.avgBasket >= avgBasketYesterday ? 'up' : 'down'}
              sub={`${kpis.paidOrders} ödemeli sipariş`}
              href={`/dashboard/${restaurantId}/analytics`}
            />
            <KPICard
              label="Oturum sayısı"
              value={String(kpis.sessions)}
              delta={pct(kpis.sessions, kpis.sessionsYesterday)}
              trend={kpis.sessions >= kpis.sessionsYesterday ? 'up' : 'down'}
              sub={`dün ${kpis.sessionsYesterday} oturum`}
              href={`/dashboard/${restaurantId}/analytics`}
            />
          </div>

          {/* Main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
            <SalesChart restaurantId={restaurantId} initialHourly={hourlySales} />
            <ActivityFeedWidget
              feed={feed}
              restaurantId={restaurantId}
              onStatusChange={(orderId, status) => {
                setFeed((previous) => previous.map((event) => (
                  event.id === orderId ? { ...event, status } : event
                )))
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <TopItemsWidget items={topItems} />
            <PeakHours heatmap={heatmap} />
            <QuickActions restaurantId={restaurantId} />
          </div>

          {/* Wide row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <TableStatusExperience
              restaurantId={restaurantId}
              tables={liveTableStatuses}
              onFloorPlan={() => setShowFloorPlan(true)}
              onNewOrder={openNewOrder}
              onRefresh={() => void refreshTables()}
            />
            <SystemHealth paymentStatus={paymentStatus} isOwner={isOwner} realtime={realtime} lastOrderAt={lastOrderAt} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── KPI CARD ─────────────────────────────────────── */
function KPICard({ label, value, delta, trend, sub, featured, href }: {
  label: string; value: string; delta: string; trend: 'up' | 'down'; sub: string; featured?: boolean; href?: string
}) {
  const [hov, setHov] = useState(false)
  const trendBg = trend === 'up' ? 'var(--positive-bg)' : 'var(--critical-bg)'
  const trendFg = trend === 'up' ? 'var(--positive)' : 'var(--critical)'
  const card = (
    <div
      onMouseEnter={href ? () => setHov(true) : undefined}
      onMouseLeave={href ? () => setHov(false) : undefined}
      style={{
        background: featured ? 'linear-gradient(135deg, #18181b 0%, #2a2a30 100%)' : (hov ? 'var(--surface-2)' : 'var(--surface)'),
        color: featured ? '#fff' : 'var(--text)',
        borderRadius: 12, border: '1px solid ' + (featured ? 'transparent' : (hov ? 'var(--border-strong)' : 'var(--border)')),
        padding: 16, position: 'relative', overflow: 'hidden',
        cursor: href ? 'pointer' : 'default',
        transition: 'background 120ms, border-color 120ms',
      }}>
      {featured && (
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 120, height: 120,
          background: 'radial-gradient(circle, rgba(255,208,137,.15) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          fontSize: 11.5, fontWeight: 500,
          color: featured ? 'rgba(255,255,255,.55)' : 'var(--text-3)',
          letterSpacing: '.05em', textTransform: 'uppercase',
        }}>{label}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 999,
          background: featured ? 'rgba(94, 232, 164, .15)' : trendBg,
          color: featured ? '#5ee8a4' : trendFg,
          fontSize: 10.5, fontWeight: 600,
        }}>{trend === 'up' ? '↑' : '↓'}{delta}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1,
        ...S.mono, color: featured ? '#ffd089' : 'var(--text)',
      }}>{value}</div>
      <div style={{ fontSize: 11, color: featured ? 'rgba(255,255,255,.55)' : 'var(--text-3)', marginTop: 6 }}>{sub}</div>
    </div>
  )
  if (!href) return card
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {card}
    </Link>
  )
}

/* ── SALES CHART (range-aware: today hourly / 7d / 30d daily) ───────────── */
function summarizePoints(points: PanoChartPoint[]): { total: number; peakLabel: string; peakValue: number } {
  const total = points.reduce((s, p) => s + p.value, 0)
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0] ?? { label: '', value: 0 })
  return { total, peakLabel: peak.label, peakValue: peak.value }
}

const CHART_RANGES: { label: string; range: PanoChartRange }[] = [
  { label: 'Bugün', range: 'day' },
  { label: '7 gün', range: 'week' },
  { label: '30 gün', range: 'month' },
]

function SalesChart({ restaurantId, initialHourly }: { restaurantId: string; initialHourly: HourlySale[] }) {
  const seedPoints = dayPointsFromHourly(initialHourly)
  const [data, setData] = useState<PanoChartData>({ range: 'day', rangeLabel: 'Bugün', points: seedPoints, ...summarizePoints(seedPoints) })
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function selectRange(range: PanoChartRange) {
    if (range === data.range || isPending) return
    setError('')
    startTransition(async () => {
      const res = await fetchPanoChart(restaurantId, range)
      if ('error' in res) { setError('Veri alınamadı'); return }
      setData(res)
    })
  }

  const W = 720, H = 220, padX = 28, padY = 20
  const points = data.points
  const max = Math.max(...points.map(p => p.value), 1)
  const slot = (W - padX * 2) / Math.max(points.length, 1)
  const barW = Math.max(2, slot - 6)
  const labelStep = points.length > 16 ? Math.ceil(points.length / 8) : 2
  const isDay = data.range === 'day'

  return (
    <Card title="Tahsilat akışı" subtitle={isDay ? 'Saatlik tahsilat · TRY' : `${data.rangeLabel} · günlük tahsilat · TRY`}>
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <span style={{ ...S.mono, fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', opacity: isPending ? 0.5 : 1 }}>
            ₺{data.total.toLocaleString('tr-TR')}
          </span>
          {isPending && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>yükleniyor…</span>}
          <div style={{ marginLeft: 'auto', display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 6, padding: 2 }}>
            {CHART_RANGES.map(({ label, range }) => (
              <button key={range} onClick={() => selectRange(range)} disabled={isPending} style={{
                padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
                background: data.range === range ? 'var(--surface)' : 'transparent',
                color: data.range === range ? 'var(--text)' : 'var(--text-2)',
                boxShadow: data.range === range ? 'var(--shadow-1)' : 'none',
                border: 'none', borderRadius: 4, cursor: isPending ? 'default' : 'pointer',
              }}>{label}</button>
            ))}
          </div>
        </div>
        {error ? (
          <div style={{ padding: '46px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--critical)' }}>{error}</div>
        ) : data.total === 0 ? (
          <div style={{ padding: '46px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>Bu aralıkta tahsilat yok</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', opacity: isPending ? 0.5 : 1, transition: 'opacity 120ms' }} preserveAspectRatio="none">
            {[0, 0.25, 0.5, 0.75, 1].map(p => {
              const y = padY + (H - padY * 2) * (1 - p)
              return <line key={p} x1={padX} y1={y} x2={W - padX} y2={y} stroke="var(--divider)" strokeWidth="1" strokeDasharray={p === 0 ? 'none' : '3,3'} />
            })}
            {points.map((d, i) => {
              const x = padX + i * slot + (slot - barW) / 2
              const h = (H - padY * 2) * (d.value / max)
              const y = H - padY - h
              const fill = d.highlight ? '#ffd089' : d.value === 0 ? 'var(--surface-3)' : 'var(--text)'
              return (
                <g key={d.label + i}>
                  <rect x={x} y={y} width={barW} height={h || 2} rx="3" fill={fill} opacity={d.value === 0 ? 0.4 : 1} />
                  {d.highlight && <circle cx={x + barW / 2} cy={y - 6} r="3" fill="#ffd089" />}
                </g>
              )
            })}
            {points.map((d, i) => (i % labelStep === 0 ? (
              <text key={'l' + i} x={padX + i * slot + slot / 2} y={H - 4} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="Geist Mono, monospace">
                {d.label}
              </text>
            ) : null))}
          </svg>
        )}
        <div style={{
          display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)',
          marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--divider)', flexWrap: 'wrap',
        }}>
          <LegendDot color="var(--text)" label={`Tahsilat ₺${data.total.toLocaleString('tr-TR')}`} />
          {isDay && <LegendDot color="#ffd089" label={`Şu an ${String(new Date().getHours()).padStart(2, '0')}:00`} />}
          {data.peakValue > 0 && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {isDay ? 'Pik saat' : 'Pik gün'} <span style={{ ...S.mono, color: 'var(--text-2)', fontWeight: 600 }}>
                {isDay ? `${data.peakLabel}:00` : data.peakLabel} ₺{data.peakValue.toLocaleString('tr-TR')}
              </span>
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  )
}

/* ── ACTIVITY FEED ────────────────────────────────── */
const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  pending:           { bg: 'var(--warning-bg)',  fg: 'var(--warning)' },
  pending_approval:  { bg: 'var(--warning-bg)',  fg: 'var(--warning)' },
  sent_to_kitchen:   { bg: 'var(--info-bg)',     fg: 'var(--info)' },
  preparing:         { bg: 'var(--info-bg)',     fg: 'var(--info)' },
  ready:             { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  served:            { bg: 'var(--surface-3)',   fg: 'var(--text-2)' },
  paid:              { bg: 'var(--surface-3)',   fg: 'var(--text-2)' },
  cancelled:         { bg: 'var(--critical-bg)', fg: 'var(--critical)' },
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Yeni sipariş', pending_approval: 'Onay bekliyor',
  sent_to_kitchen: 'Mutfağa gönderildi', preparing: 'Hazırlanıyor',
  ready: 'Hazır', served: 'Servis edildi', paid: 'Ödendi', cancelled: 'İptal',
}

const STATUS_ICONS: Record<string, ReactNode> = {
  pending: <I.receipt size={13} />,
  pending_approval: <I.clock size={13} />,
  sent_to_kitchen: <I.cutlery size={13} />,
  preparing: <I.clock size={13} />,
  ready: <I.check size={13} />,
  served: <I.cutlery size={13} />,
  paid: <I.card size={13} />,
  cancelled: <I.x size={13} />,
}

function ActivityFeedWidget({
  feed,
  restaurantId,
  onStatusChange,
}: {
  feed: ActivityEvent[]
  restaurantId: string
  onStatusChange: (orderId: string, status: string) => void
}) {
  return (
    <Card title="Canlı akış" subtitle="Bugünün sipariş aktivitesi · gerçek zamanlı">
      <style>{`
        .pano-feed-action {
          opacity: 0;
          pointer-events: none;
          transform: translateX(4px);
          transition: opacity 120ms ease, transform 120ms ease;
        }
        .pano-feed-row:hover .pano-feed-action,
        .pano-feed-row:focus-within .pano-feed-action {
          opacity: 1;
          pointer-events: auto;
          transform: none;
        }
        .pano-feed-time { transition: opacity 120ms ease; }
        .pano-feed-row:hover .pano-feed-time,
        .pano-feed-row:focus-within .pano-feed-time { opacity: 0; }
        .pano-feed-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid color-mix(in srgb, var(--positive) 25%, transparent);
          border-top-color: var(--positive);
          border-radius: 999px;
          animation: pano-feed-spin .7s linear infinite;
        }
        @keyframes pano-feed-spin { to { transform: rotate(360deg); } }
        @media (hover: none) {
          .pano-feed-action {
            opacity: 1;
            pointer-events: auto;
            transform: none;
          }
          .pano-feed-time { opacity: 0; }
        }
      `}</style>
      {feed.length === 0
        ? <EmptyState title="Bugün henüz sipariş yok" sub="Yeni siparişler burada anlık görünür" />
        : (
          <div style={{ padding: '0 0 8px', maxHeight: 360, overflow: 'auto' }}>
            {feed.map((event, index) => (
              <ActivityFeedRow
                key={event.id}
                event={event}
                restaurantId={restaurantId}
                last={index === feed.length - 1}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        )
      }
    </Card>
  )
}

function ActivityFeedRow({
  event,
  restaurantId,
  last,
  onStatusChange,
}: {
  event: ActivityEvent
  restaurantId: string
  last: boolean
  onStatusChange: (orderId: string, status: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tone = STATUS_TONES[event.status] ?? STATUS_TONES['pending']!
  const canApprove = event.status === 'pending_approval'

  const approve = async () => {
    if (busy || !canApprove) return
    setBusy(true)
    setError(null)
    const result = await updateOrderStatus(event.id, 'sent_to_kitchen', restaurantId)
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onStatusChange(event.id, 'sent_to_kitchen')
  }

  return (
    <div
      className="pano-feed-row"
      style={{
        position: 'relative', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10,
        minHeight: 58, borderBottom: last ? 'none' : '1px solid var(--divider)',
        background: error ? 'var(--critical-bg)' : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 999,
        background: tone.bg, color: tone.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{STATUS_ICONS[event.status] ?? <I.bell size={13} />}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: error ? 'var(--critical)' : 'var(--text)' }}>
          {error ?? STATUS_LABELS[event.status] ?? event.status}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
          {(event.tableLabel ?? (event.tableId ? 'Masa' : 'Paket'))} · ₺{event.total.toLocaleString('tr-TR')}
        </div>
      </div>
      {canApprove ? (
        <div style={{ position: 'relative', width: 90, height: 30, flexShrink: 0 }}>
          <span className="pano-feed-time" style={{
            ...S.mono, position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            fontSize: 10.5, color: 'var(--text-3)',
          }}>
            {relTime(event.createdAt)}
          </span>
          <button
            type="button"
            className="pano-feed-action"
            disabled={busy}
            onClick={() => void approve()}
            aria-label={`${event.tableLabel ?? 'Sipariş'} siparişini onayla`}
            style={{
              position: 'absolute', right: 0, top: 0,
              height: 30, padding: '0 10px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              border: '1px solid var(--positive)', borderRadius: 7,
              background: 'var(--positive-bg)', color: 'var(--positive)',
              fontSize: 11.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? <span className="pano-feed-spinner" /> : <I.check size={13} />}
            {busy ? 'Onaylanıyor' : 'Onayla'}
          </button>
        </div>
      ) : (
        <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>
          {relTime(event.createdAt)}
        </span>
      )}
    </div>
  )
}

/* ── TOP ITEMS ────────────────────────────────────── */
function TopItemsWidget({ items }: { items: TopItem[] }) {
  const maxCount = items[0]?.count ?? 1
  return (
    <Card title="Bugünün yıldızları" subtitle="Tahsil edilmiş siparişlerden">
      {items.length === 0
        ? <EmptyState title="Henüz satış yok" sub="Siparişlerden sonra ürünler burada görünür" />
        : (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it, i) => {
              const pct = (it.count / maxCount) * 100
              return (
                <div key={it.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-4)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    <span style={{ ...S.mono, fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>×{it.count}</span>
                    <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>₺{it.revenue.toLocaleString('tr-TR')}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', marginLeft: 24 }}>
                    <div style={{ height: '100%', width: pct + '%', background: i === 0 ? '#ffd089' : 'var(--text)', transition: 'width 240ms' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </Card>
  )
}

/* ── PEAK HOURS (real: getHeatmapData, last 30 days order volume) ───────── */
const HEATMAP_HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8..22 — matches getHeatmapData

function PeakHours({ heatmap }: { heatmap: HeatmapCell[] }) {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] // day 0=Mon … 6=Sun
  const grid: Record<string, number> = {}
  let maxCount = 0
  for (const c of heatmap) {
    grid[`${c.day}-${c.hour}`] = c.count
    if (c.count > maxCount) maxCount = c.count
  }

  return (
    <Card title="Yoğun saatler" subtitle="Son 30 gün · sipariş yoğunluğu">
      {maxCount === 0 ? (
        <EmptyState title="Yeterli veri yok" sub="Siparişler biriktikçe yoğun saatler burada görünür" />
      ) : (
        <div style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${HEATMAP_HOURS.length}, 1fr)`, gap: 1.5, alignItems: 'center' }}>
            <span />
            {HEATMAP_HOURS.map(h => (
              <span key={h} style={{ fontSize: 8, color: 'var(--text-4)', textAlign: 'center', ...S.mono }}>
                {h % 3 === 0 ? h : ''}
              </span>
            ))}
            {days.map((d, dayIdx) => (
              <Fragment key={d}>
                <span key={d + '-l'} style={{ fontSize: 9.5, color: 'var(--text-3)', paddingRight: 5, fontWeight: 500 }}>{d}</span>
                {HEATMAP_HOURS.map(h => {
                  const count = grid[`${dayIdx}-${h}`] ?? 0
                  const v = count / maxCount
                  return (
                    <div
                      key={`${d}-${h}`}
                      title={`${d} ${String(h).padStart(2, '0')}:00 · ${count} sipariş`}
                      style={{
                        aspectRatio: '1', borderRadius: 1.5,
                        background: count === 0 ? 'var(--surface-3)' : `rgba(47, 111, 78, ${0.18 + v * 0.82})`,
                      }}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-3)' }}>
            <span>Az</span>
            <div style={{ display: 'flex', gap: 2, flex: 1, margin: '0 8px', maxWidth: 100 }}>
              {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
                <div key={o} style={{ flex: 1, height: 8, borderRadius: 1, background: `rgba(47, 111, 78, ${o})` }} />
              ))}
            </div>
            <span>Çok</span>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ── QUICK ACTIONS ────────────────────────────────── */
function QuickActions({ restaurantId }: { restaurantId: string }) {
  const actions = [
    { label: 'Ürün ekle',      desc: 'Menüye yeni kalem',     icon: <I.plus size={15} />, href: `/dashboard/${restaurantId}/menu` },
    { label: 'QR yazdır',      desc: "Masa QR'larını indir",  icon: <I.qr size={15} />, href: `/dashboard/${restaurantId}/tables` },
    { label: 'Temayı düzenle', desc: 'Marka kimliğin',        icon: <I.palette size={15} />, href: `/dashboard/${restaurantId}/theme` },
    // Honest targets: /orders is the dashboard order board (not the separate KDS app);
    // there is no PDF export, so this just opens the Analytics page.
    { label: 'Sipariş panosu', desc: 'Canlı sipariş akışı',   icon: <I.clipboard size={15} />, href: `/dashboard/${restaurantId}/orders` },
    { label: 'Raporlar',       desc: 'Satış & tahsilat analizi', icon: <I.chart size={15} />, href: `/dashboard/${restaurantId}/analytics` },
  ] satisfies Array<{ label: string; desc: string; icon: ReactNode; href: string }>
  return (
    <Card title="Hızlı işlemler" subtitle="Tek tıkla başla">
      <div style={{ padding: 8 }}>
        {actions.map((a, i) => (
          <a key={i} href={a.href} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', marginBottom: 1, borderRadius: 7,
            background: 'transparent', textDecoration: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--surface-3)', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{a.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{a.desc}</div>
            </div>
            <span style={{ color: 'var(--text-4)', display: 'inline-flex' }}><I.chevRight size={13} /></span>
          </a>
        ))}
      </div>
    </Card>
  )
}

/* ── CONNECTION STATUS (real signals only — no faked integrations) ───────── */
type HealthStatus = 'ok' | 'warn' | 'down' | 'idle'
interface HealthCheck { label: string; status: HealthStatus; detail: string }

const HEALTH_COLORS: Record<HealthStatus, { dot: string; fg: string; label: string }> = {
  ok:   { dot: 'var(--positive)', fg: 'var(--positive)', label: 'Aktif' },
  warn: { dot: 'var(--warning)',  fg: 'var(--warning)',  label: 'Dikkat' },
  down: { dot: 'var(--critical)', fg: 'var(--critical)', label: 'Yok' },
  idle: { dot: 'var(--text-4)',   fg: 'var(--text-3)',   label: '—' },
}

/** Precise relative time for the health panel (no "Dün" cap — shows real day count). */
function sinceLabel(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'az önce'
  if (sec < 3600) return `${Math.floor(sec / 60)} dk önce`
  if (sec < 86400) return `${Math.floor(sec / 3600)} sa önce`
  return `${Math.floor(sec / 86400)} gün önce`
}

function SystemHealth({ paymentStatus, isOwner, realtime, lastOrderAt }: {
  paymentStatus: PaymentStatus | null
  isOwner: boolean
  realtime: RealtimeStatus
  lastOrderAt: string | null
}) {
  // Built ONLY from genuinely checkable signals. To add a real integration later
  // (printer / Yemeksepeti / …), push one HealthCheck from its real source here —
  // never invent a status for something that isn't wired.
  const checks: HealthCheck[] = []

  // 1) İyzico payment — derived from payment_credentials (owner-only).
  if (isOwner && paymentStatus) {
    checks.push(
      !paymentStatus.configured
        ? { label: 'İyzico ödeme', status: 'down', detail: 'Yapılandırılmamış' }
        : paymentStatus.mode === 'live'
          ? { label: 'İyzico ödeme', status: 'ok', detail: 'Canlı · bağlı' }
          : { label: 'İyzico ödeme', status: 'warn', detail: 'Test modu (sandbox)' },
    )
  }

  // 2) Realtime — THIS session's Supabase channel connection state.
  checks.push(
    realtime === 'connected' ? { label: 'Gerçek zamanlı', status: 'ok', detail: 'Canlı bağlantı açık' }
    : realtime === 'down' ? { label: 'Gerçek zamanlı', status: 'down', detail: 'Bağlantı yok' }
    : { label: 'Gerçek zamanlı', status: 'idle', detail: 'Bağlanıyor…' },
  )

  // 3) Last order — activity liveness proxy (recent = ok, stale = idle).
  const lastSec = lastOrderAt ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 1000) : null
  checks.push(
    lastOrderAt
      ? { label: 'Son sipariş', status: lastSec !== null && lastSec < 86400 ? 'ok' : 'idle', detail: sinceLabel(lastOrderAt) }
      : { label: 'Son sipariş', status: 'idle', detail: 'Henüz sipariş yok' },
  )

  return (
    <Card title="Bağlantı durumu" subtitle="Gerçek zamanlı sinyaller">
      <div style={{ padding: '4px 0' }}>
        {checks.map((sv, i) => {
          const c = HEALTH_COLORS[sv.status]
          return (
            <div key={sv.label} style={{
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: i === checks.length - 1 ? 'none' : '1px solid var(--divider)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{sv.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{sv.detail}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: c.fg }}>{c.label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ── SHARED: CARD ─────────────────────────────────── */
function Card({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--divider)',
      }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}
