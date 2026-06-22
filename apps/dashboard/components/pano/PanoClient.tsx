'use client'

import { Fragment, useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import PageTopBar from '../layout/PageTopBar'
import { I, S, Tag, EmptyState, btnPrimary } from '../../lib/ui'
import NewOrderModal from '../overlays/NewOrderModal'
import DateRangePicker from '../overlays/DateRangePicker'
import FloorPlan from '../overlays/FloorPlan'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type {
  DashboardKPIs,
  HourlySale,
  ActivityEvent,
  TopItem,
  TableStatusData,
} from '../../lib/queries'

interface Props {
  restaurantId: string
  restaurantName: string
  kpis: DashboardKPIs
  hourlySales: HourlySale[]
  initialFeed: ActivityEvent[]
  topItems: TopItem[]
  tableStatuses: TableStatusData[]
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

export default function PanoClient({ restaurantId, restaurantName, kpis, hourlySales, initialFeed, topItems, tableStatuses }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
  const todayLabel = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showDateRange, setShowDateRange] = useState(false)
  const [showFloorPlan, setShowFloorPlan] = useState(false)
  const [feed, setFeed] = useState<ActivityEvent[]>(initialFeed)

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    const channel = supabase
      .channel(`orders:${restaurantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, payload => {
        const row = payload.new as { id: string; status: string; total: number; table_id: string | null; created_at: string }
        setFeed(prev => [
          { id: row.id, status: row.status, total: row.total, tableId: row.table_id, createdAt: row.created_at },
          ...prev,
        ].slice(0, 7))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [restaurantId])

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
            <button
              onClick={() => setShowDateRange(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', height: 30, borderRadius: 7,
                background: 'var(--surface-3)', fontSize: 11.5, color: 'var(--text-2)',
                border: 'none', cursor: 'pointer',
              }}
            >
              <span style={S.mono}>{todayLabel}</span>
              <span style={{ color: 'var(--text-4)' }}>·</span>
              <span style={S.mono}>Bugün</span>
              <I.chevDown size={12} />
            </button>
            <button onClick={() => setShowNewOrder(true)} style={btnPrimary()}>
              <I.plus size={13} />Yeni sipariş
            </button>
          </>
        }
      />

      {showNewOrder && (
        <NewOrderModal
          restaurantId={restaurantId}
          tableStatuses={tableStatuses}
          onClose={() => setShowNewOrder(false)}
        />
      )}
      {showDateRange && <DateRangePicker onClose={() => setShowDateRange(false)} />}
      {showFloorPlan && <FloorPlan restaurantName={restaurantName} tableStatuses={tableStatuses} onClose={() => setShowFloorPlan(false)} />}

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
            <SalesChart hourlySales={hourlySales} totalRevenue={kpis.revenue} />
            <ActivityFeedWidget feed={feed} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <TopItemsWidget items={topItems} />
            <PeakHours />
            <QuickActions restaurantId={restaurantId} />
          </div>

          {/* Wide row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <TableStatusWidget tables={tableStatuses} onFloorPlan={() => setShowFloorPlan(true)} />
            <SystemHealth />
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

/* ── SALES CHART ──────────────────────────────────── */
function SalesChart({ hourlySales, totalRevenue }: { hourlySales: HourlySale[]; totalRevenue: number }) {
  const [period, setPeriod] = useState(0)
  const currentHour = new Date().getHours()
  const max = Math.max(...hourlySales.map(d => d.total), 1)
  const W = 720, H = 220, padX = 28, padY = 20
  const visibleHours = hourlySales.filter(d => d.hour >= 7 && d.hour <= 22)
  const barW = (W - padX * 2) / visibleHours.length - 6
  const peakHour = hourlySales.reduce((a, b) => b.total > a.total ? b : a, hourlySales[0] ?? { hour: 0, total: 0 })

  return (
    <Card title="Tahsilat akışı" subtitle="Saatlik tahsilat · TRY">
      <div style={{ padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <span style={{ ...S.mono, fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>
            ₺{totalRevenue.toLocaleString('tr-TR')}
          </span>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 6, padding: 2 }}>
            {['Bugün', '7 gün', '30 gün'].map((t, i) => (
              <button key={t} onClick={() => setPeriod(i)} style={{
                padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
                background: period === i ? 'var(--surface)' : 'transparent',
                color: period === i ? 'var(--text)' : 'var(--text-2)',
                boxShadow: period === i ? 'var(--shadow-1)' : 'none',
                border: 'none', borderRadius: 4, cursor: 'pointer',
              }}>{t}</button>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map(p => {
            const y = padY + (H - padY * 2) * (1 - p)
            return <line key={p} x1={padX} y1={y} x2={W - padX} y2={y} stroke="var(--divider)" strokeWidth="1" strokeDasharray={p === 0 ? 'none' : '3,3'} />
          })}
          {visibleHours.map((d, i) => {
            const x = padX + i * ((W - padX * 2) / visibleHours.length) + 3
            const h = (H - padY * 2) * (d.total / max)
            const y = H - padY - h
            const isCurrent = d.hour === currentHour
            const fill = isCurrent ? '#ffd089' : d.total === 0 ? 'var(--surface-3)' : 'var(--text)'
            return (
              <g key={d.hour}>
                <rect x={x} y={y} width={barW} height={h || 2} rx="3" fill={fill} opacity={d.total === 0 ? 0.4 : 1} />
                {isCurrent && <circle cx={x + barW / 2} cy={y - 6} r="3" fill="#ffd089" />}
              </g>
            )
          })}
          {visibleHours.filter((_, i) => i % 2 === 0).map((d, idx) => {
            const i = visibleHours.indexOf(d)
            const x = padX + i * ((W - padX * 2) / visibleHours.length) + barW / 2 + 3
            return (
              <text key={idx} x={x} y={H - 4} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="Geist Mono, monospace">
                {String(d.hour).padStart(2, '0')}
              </text>
            )
          })}
        </svg>
        <div style={{
          display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)',
          marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--divider)',
        }}>
          <LegendDot color="var(--text)" label={`Tahsilat ₺${totalRevenue.toLocaleString('tr-TR')}`} />
          <LegendDot color="#ffd089" label={`Şu an ${String(currentHour).padStart(2, '0')}:00`} />
          {peakHour.total > 0 && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Pik saat <span style={{ ...S.mono, color: 'var(--text-2)', fontWeight: 600 }}>
                {String(peakHour.hour).padStart(2, '0')}:00 ₺{peakHour.total.toLocaleString('tr-TR')}
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

function ActivityFeedWidget({ feed }: { feed: ActivityEvent[] }) {
  return (
    <Card title="Canlı akış" subtitle="Sipariş aktivitesi · gerçek zamanlı">
      {feed.length === 0
        ? <EmptyState title="Henüz sipariş yok" sub="Siparişler burada görünür" />
        : (
          <div style={{ padding: '0 0 8px', maxHeight: 360, overflow: 'auto' }}>
            {feed.map((e, i) => {
              const tone = STATUS_TONES[e.status] ?? STATUS_TONES['pending']!
              return (
                <div key={e.id} style={{
                  padding: '11px 16px', display: 'flex', gap: 10,
                  borderBottom: i === feed.length - 1 ? 'none' : '1px solid var(--divider)',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: tone.bg, color: tone.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{STATUS_ICONS[e.status] ?? <I.bell size={13} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>
                      {STATUS_LABELS[e.status] ?? e.status}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                      {e.tableId ? `Masa · ` : ''}₺{e.total.toLocaleString('tr-TR')}
                    </div>
                  </div>
                  <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>
                    {relTime(e.createdAt)}
                  </span>
                </div>
              )
            })}
          </div>
        )
      }
    </Card>
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

/* ── PEAK HOURS ───────────────────────────────────── */
function PeakHours() {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  const heat = (d: number, h: number) => {
    if (h < 8 || h > 22) return 0
    const base = h >= 12 && h <= 14 ? 0.9 : h >= 18 && h <= 21 ? 0.85 : 0.4
    const dayMod = d >= 4 ? 1.1 : 0.95
    const seed = ((d * 13 + h * 7 + 23) % 100) / 100
    return Math.min(1, base * dayMod * (0.7 + seed * 0.6))
  }
  return (
    <Card title="Yoğun saatler" subtitle="Son 30 gün ortalaması">
      <div style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 1.5, alignItems: 'center' }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} style={{ fontSize: 8, color: 'var(--text-4)', textAlign: 'center', ...S.mono }}>
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
          {days.map((d, dayIdx) => (
            <Fragment key={d}>
              <span key={d + '-l'} style={{ fontSize: 9.5, color: 'var(--text-3)', paddingRight: 5, fontWeight: 500 }}>{d}</span>
              {Array.from({ length: 24 }, (_, h) => {
                const v = heat(dayIdx, h)
                return (
                  <div key={`${d}-${h}`} style={{
                    aspectRatio: '1', borderRadius: 1.5,
                    background: v === 0 ? 'var(--surface-3)' : `rgba(47, 111, 78, ${v})`,
                  }} />
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
    </Card>
  )
}

/* ── QUICK ACTIONS ────────────────────────────────── */
function QuickActions({ restaurantId }: { restaurantId: string }) {
  const actions = [
    { label: 'Ürün ekle',     desc: 'Menüye yeni kalem',     icon: <I.plus size={15} />, href: `/dashboard/${restaurantId}/menu` },
    { label: 'QR yazdır',     desc: "Masa QR'larını indir",  icon: <I.qr size={15} />, href: `/dashboard/${restaurantId}/tables` },
    { label: 'Temayı düzenle', desc: 'Marka kimliğin',       icon: <I.palette size={15} />, href: `/dashboard/${restaurantId}/theme` },
    { label: 'Mutfak ekranı', desc: 'TV/tablet için',        icon: <I.monitor size={15} />, href: `/dashboard/${restaurantId}/orders` },
    { label: 'Rapor indir',   desc: 'Günlük özet PDF',       icon: <I.page size={15} />, href: `/dashboard/${restaurantId}/analytics` },
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

/* ── TABLE STATUS ─────────────────────────────────── */
function TableStatusWidget({ tables, onFloorPlan }: { tables: TableStatusData[]; onFloorPlan: () => void }) {
  const active = tables.filter(t => t.status === 'active' || t.status === 'new' || t.status === 'late').length
  const empty = tables.filter(t => t.status === 'empty').length
  const paid = tables.filter(t => t.status === 'paid').length
  return (
    <Card
      title="Masa durumu"
      subtitle={`Açık adisyonlar · ${active} aktif, ${paid} ödendi, ${empty} boş`}
      action={
        <button
          onClick={onFloorPlan}
          style={{ color: 'var(--text-2)', fontSize: 11.5, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 2 }}
        >
          Plan görünümü <I.chevRight size={11} />
        </button>
      }
    >
      {tables.length === 0
        ? <EmptyState title="Masa tanımlanmamış" sub="Masalar sekmesinden masa ekleyebilirsin" />
        : (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
              {tables.map(t => <TableCell key={t.id} table={t} />)}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--divider)', fontSize: 11, color: 'var(--text-3)' }}>
              <LegendDot color="var(--info)" label="Aktif" />
              <LegendDot color="var(--warning)" label="Yeni" />
              <LegendDot color="var(--critical)" label="Geciken" />
              <LegendDot color="var(--positive)" label="Ödendi" />
              <LegendDot color="var(--surface-3)" label="Boş" />
            </div>
          </div>
        )
      }
    </Card>
  )
}

function TableCell({ table }: { table: TableStatusData }) {
  const COLORS: Record<string, { bg: string; fg: string; border: string }> = {
    empty:  { bg: 'var(--surface-3)',   fg: 'var(--text-3)',   border: 'var(--border)' },
    paid:   { bg: 'var(--positive-bg)', fg: 'var(--positive)', border: 'var(--positive-bg)' },
    active: { bg: 'var(--info-bg)',     fg: 'var(--info)',     border: 'var(--info-bg)' },
    new:    { bg: 'var(--warning-bg)',  fg: 'var(--warning)',  border: 'var(--warning-bg)' },
    late:   { bg: 'var(--critical-bg)', fg: 'var(--critical)', border: 'var(--critical)' },
  }
  const c = COLORS[table.status] ?? COLORS['empty']!
  const label =
    table.status === 'empty' ? '—' :
    table.status === 'paid'  ? `ödendi · ₺${table.total}` :
    table.unpaidTotal > 0 ? `${table.time}dk · ₺${table.unpaidTotal}` :
    `${table.time}dk · aktif`
  return (
    <div style={{
      padding: '10px 8px', background: c.bg, borderRadius: 8, textAlign: 'center',
      border: '1px solid ' + c.border,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: c.fg }}>{table.label}</div>
      <div style={{ ...S.mono, fontSize: 10, color: c.fg, opacity: 0.8, marginTop: 2, minHeight: 12 }}>{label}</div>
    </div>
  )
}

/* ── SYSTEM HEALTH ────────────────────────────────── */
function SystemHealth() {
  const services = [
    { name: 'iyzico',         status: 'ok'   as const, detail: 'Ödeme · aktif' },
    { name: 'Mutfak Yazıcı',  status: 'ok'   as const, detail: 'Çevrimiçi' },
    { name: 'Bar Yazıcı',     status: 'ok'   as const, detail: 'Çevrimiçi' },
    { name: 'Kasa Yazıcı',    status: 'down' as const, detail: 'Bağlantı koptu' },
    { name: 'WiFi',           status: 'ok'   as const, detail: 'Bağlı' },
    { name: 'Yemeksepeti',    status: 'warn' as const, detail: 'Senk. gecikme' },
  ]
  const COLORS = {
    ok:   { dot: 'var(--positive)', fg: 'var(--positive)', label: 'Çevrimiçi' },
    warn: { dot: 'var(--warning)',  fg: 'var(--warning)',  label: 'Yavaş' },
    down: { dot: 'var(--critical)', fg: 'var(--critical)', label: 'Çevrimdışı' },
  }
  return (
    <Card title="Sistem sağlığı" subtitle="Tüm bağlı servisler">
      <div style={{ padding: '4px 0' }}>
        {services.map((sv, i) => {
          const c = COLORS[sv.status]
          return (
            <div key={i} style={{
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: i === services.length - 1 ? 'none' : '1px solid var(--divider)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{sv.name}</div>
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
