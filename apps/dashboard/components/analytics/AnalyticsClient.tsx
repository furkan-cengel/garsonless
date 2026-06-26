'use client'

import { useState, useTransition, Fragment, type ReactNode, type CSSProperties } from 'react'
import PageTopBar from '../layout/PageTopBar'
import { I, btnPrimary, btnGhost } from '../../lib/ui'
import type {
  DashboardKPIs,
  TopItem,
  DailySale,
  HeatmapCell,
  TableReportRow,
  PaymentBreakdown,
  PaymentReport,
  ProductReportItem,
} from '../../lib/queries'
import { fetchAnalyticsReportData, type AnalyticsReportId } from '../../lib/actions/analytics'
import { formatCurrency } from '../../lib/utils'

const s = {
  mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as React.CSSProperties,
}

const REPORTS = [
  { id: 'sales', label: 'Satışlar', icon: <I.chart size={15} />, desc: 'Tahsilat & hacim' },
  { id: 'items', label: 'Ürünler', icon: <I.cutlery size={15} />, desc: 'Ürün performansı' },
  { id: 'tables', label: 'Masalar', icon: <I.chair size={15} />, desc: 'Doluluk & tahsilat' },
  { id: 'payments', label: 'Ödemeler', icon: <I.card size={15} />, desc: 'Yöntem dağılımı' },
] satisfies Array<{ id: AnalyticsReportId; label: string; icon: ReactNode; desc: string }>

const RANGES = [
  { id: 'day', label: 'Bugün' },
  { id: 'week', label: '7G' },
  { id: 'month', label: '30G' },
  { id: 'quarter', label: 'Çeyrek' },
  { id: 'year', label: 'Yıl' },
]

function rangeLabel(range: string): string {
  return RANGES.find((r) => r.id === range)?.label ?? '7G'
}

interface Props {
  restaurantId: string
  restaurantName: string
  kpis: DashboardKPIs
  topItems: TopItem[]
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  tableStats: TableReportRow[]
  paymentBreakdown: PaymentReport
  productReport: ProductReportItem[]
}

export default function AnalyticsClient({
  restaurantId,
  restaurantName,
  kpis,
  topItems,
  salesOverTime,
  heatmapData,
  tableStats,
  paymentBreakdown,
  productReport,
}: Props) {
  const [activeReport, setActiveReport] = useState<AnalyticsReportId>('sales')
  const [range, setRange] = useState('week')
  const [analyticsData, setAnalyticsData] = useState({
    salesOverTime,
    heatmapData,
    tableStats,
    topItems,
    paymentBreakdown,
    productReport,
  })
  const [loadedReports, setLoadedReports] = useState<Record<AnalyticsReportId, boolean>>({
    sales: true,
    items: productReport.length > 0,
    tables: tableStats.length > 0,
    payments: true,
  })
  const [isPending, startTransition] = useTransition()

  function markReportLoaded(report: AnalyticsReportId) {
    setLoadedReports((prev) => ({
      ...prev,
      [report]: true,
      ...(report === 'sales' ? { payments: true } : null),
    }))
  }

  function loadReport(report: AnalyticsReportId, nextRange = range) {
    startTransition(async () => {
      const data = await fetchAnalyticsReportData(restaurantId, nextRange, report)
      setAnalyticsData((prev) => ({ ...prev, ...data }))
      markReportLoaded(report)
    })
  }

  function handleReportChange(report: AnalyticsReportId) {
    setActiveReport(report)
    if (!loadedReports[report]) loadReport(report)
  }

  function handleRangeChange(newRange: string) {
    setRange(newRange)
    setLoadedReports({
      sales: false,
      items: false,
      tables: false,
      payments: false,
    })
    loadReport(activeReport, newRange)
  }

  const activeReportLoaded = loadedReports[activeReport]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageTopBar
        restaurantName={restaurantName}
        title="Raporlar"
        right={
          <>
            <RangePicker value={range} onChange={handleRangeChange} loading={isPending} />
            <button style={btnGhost()}><I.history size={13} />Karşılaştır</button>
            <button style={btnPrimary()}><I.image size={13} />Dışa aktar</button>
          </>
        }
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--bg)' }}>
      {/* Left nav */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Raporlar</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
            {RANGES.find(r => r.id === range)?.label ?? '7G'} · gerçek veri
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => handleReportChange(r.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 10px', marginBottom: 1, borderRadius: 7,
                background: activeReport === r.id ? 'var(--surface-inset)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: activeReport === r.id ? 'var(--text)' : 'var(--text-3)' }}>{r.icon}</span>
              <span style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: activeReport === r.id ? 600 : 500, color: 'var(--text)' }}>{r.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{r.desc}</div>
              </span>
            </button>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--text-4)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 500, padding: '14px 10px 6px' }}>
            Kaydedilmiş
          </div>
          {['Aylık özet · Mayıs', 'Vergi raporu Q1', 'Personel komisyon'].map((name, i) => (
            <button key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 10px', borderRadius: 6,
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ width: 14, display: 'inline-flex', color: 'var(--text-3)' }}><I.page size={12} /></span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{name}</span>
            </button>
          ))}
          <button style={{
            marginTop: 8, padding: '6px 10px', width: '100%',
            background: 'transparent', border: '1px dashed var(--border-strong)',
            borderRadius: 6, fontSize: 11.5, color: 'var(--text-2)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}><I.plus size={12} />Özel rapor</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, opacity: isPending ? 0.6 : 1, transition: 'opacity 150ms' }}>
        <div style={{ padding: '24px 28px 60px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 20px', color: 'var(--text)' }}>
            {REPORTS.find((r) => r.id === activeReport)?.label ?? 'Raporlar'}
          </h2>
          {!activeReportLoaded && isPending && <ReportLoading />}
          {activeReport === 'sales' && activeReportLoaded && (
            <SalesReport
              kpis={kpis}
              topItems={analyticsData.topItems}
              salesOverTime={analyticsData.salesOverTime}
              heatmapData={analyticsData.heatmapData}
              paymentBreakdown={analyticsData.paymentBreakdown}
            />
          )}
          {activeReport === 'items' && activeReportLoaded && <ItemsReport items={analyticsData.productReport} range={range} />}
          {activeReport === 'tables' && activeReportLoaded && <TablesReport tables={analyticsData.tableStats} />}
          {activeReport === 'payments' && activeReportLoaded && <PaymentsReport paymentBreakdown={analyticsData.paymentBreakdown} range={range} />}
        </div>
      </div>
      </div>
    </div>
  )
}

function ReportLoading() {
  return (
    <div style={{
      minHeight: 320,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-3)',
      fontSize: 13,
    }}>
      Rapor yükleniyor…
    </div>
  )
}

/* ── RANGE PICKER ─────────────────────────────────── */
function RangePicker({ value, onChange, loading }: { value: string; onChange: (v: string) => void; loading?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 2 }}>
      {RANGES.map((r) => (
        <button key={r.id} onClick={() => onChange(r.id)} disabled={loading} style={{
          padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
          background: value === r.id ? 'var(--surface)' : 'transparent',
          color: value === r.id ? 'var(--text)' : 'var(--text-2)',
          boxShadow: value === r.id ? 'var(--shadow-1)' : 'none',
          border: 'none', borderRadius: 5, cursor: loading ? 'default' : 'pointer',
        }}>{r.label}</button>
      ))}
    </div>
  )
}

/* ── SALES REPORT ─────────────────────────────────── */
function delta(current: number, prev: number): { text: string; down: boolean } {
  if (prev === 0) return { text: current > 0 ? '+100%' : '—', down: false }
  const pct = ((current - prev) / prev) * 100
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, down: pct < 0 }
}

function SalesReport({
  kpis,
  topItems,
  salesOverTime,
  heatmapData,
  paymentBreakdown,
}: {
  kpis: DashboardKPIs
  topItems: TopItem[]
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  paymentBreakdown: PaymentReport
}) {
  const revDelta = delta(kpis.revenue, kpis.revenueYesterday)
  const ordDelta = delta(kpis.orders, kpis.ordersYesterday)
  const sesDelta = delta(kpis.sessions, kpis.sessionsYesterday)
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 1140 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Satış Raporu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>
          {today} · dünle kıyasla
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <KPISmall label="Tahsil edilen"  value={formatCurrency(kpis.revenue)}   delta={revDelta.text} down={revDelta.down} />
        <KPISmall label="Sipariş hacmi"  value={String(kpis.orders)}            delta={ordDelta.text} down={ordDelta.down} />
        <KPISmall label="Ort. tahsilat"  value={formatCurrency(kpis.avgBasket)} delta="—" />
        <KPISmall label="Oturum"         value={String(kpis.sessions)}          delta={sesDelta.text} down={sesDelta.down} />
        <KPISmall label="Aktif sipariş"  value={String(kpis.activeOrders)}      delta="—" />
      </div>

      <Card title="Tahsilat trendi" subtitle="Seçili dönem · paid_at bazlı" style={{ marginBottom: 12 }}>
        <BigLineChart data={salesOverTime} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
        <Card title="Saat × Gün ısı haritası" subtitle="Son 30 gün · sipariş yoğunluğu">
          <BigHeatmap data={heatmapData} />
        </Card>
        <Card title="Ödeme dağılımı" subtitle="Yöntem başına tahsilat">
          <PaymentDonut segments={paymentBreakdown.collected} />
        </Card>
      </div>

      <Card title="En çok satan ürünler" subtitle="Bugün · tahsil edilmiş siparişler">
        <TopItemsTable items={topItems} />
      </Card>
    </div>
  )
}

/* ── KPI SMALL ────────────────────────────────────── */
function KPISmall({ label, value, delta, down }: { label: string; value: string; delta: string; down?: boolean }) {
  const neutral = delta === '—'
  const positive = !down && !neutral
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</div>
      <div style={{ ...s.mono, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', marginTop: 4, color: 'var(--text)' }}>{value}</div>
      <div style={{
        marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px', borderRadius: 999,
        background: neutral ? 'var(--surface-3)' : positive ? 'var(--positive-bg)' : 'var(--critical-bg)',
        color: neutral ? 'var(--text-3)' : positive ? 'var(--positive)' : 'var(--critical)',
        fontSize: 10.5, fontWeight: 600,
      }}>{neutral ? '' : positive ? '↑ ' : '↓ '}{delta}</div>
    </div>
  )
}

/* ── BIG LINE CHART ───────────────────────────────── */
function BigLineChart({ data }: { data: DailySale[] }) {
  if (data.length === 0) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Veri yok</div>
  }

  const W = 1040, H = 260, padL = 50, padR = 16, padT = 20, padB = 32
  const total = data.reduce((sum, d) => sum + d.current, 0)
  const prevTotal = data.reduce((sum, d) => sum + d.prev, 0)
  const deltaPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
  const max = Math.max(...data.map(d => Math.max(d.current, d.prev)), 1)
  const xStep = (W - padL - padR) / Math.max(data.length - 1, 1)
  const x = (i: number) => padL + i * xStep
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max)
  const line = (key: 'current' | 'prev') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[key])}`).join(' ')
  const areaPath = `${line('current')} L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`
  const peakIdx = data.reduce((best, d, i) => d.current > (data[best]?.current ?? 0) ? i : best, 0)

  const tickStep = Math.max(1, Math.floor(data.length / 8))

  return (
    <div style={{ padding: '12px 14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
        <span style={{ ...s.mono, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--text)' }}>
          {formatCurrency(total)}
        </span>
        {prevTotal > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 999,
            background: deltaPct >= 0 ? 'var(--positive-bg)' : 'var(--critical-bg)',
            color: deltaPct >= 0 ? 'var(--positive)' : 'var(--critical)',
            fontSize: 10.5, fontWeight: 600,
          }}>{deltaPct >= 0 ? '↑' : '↓'} %{Math.abs(deltaPct).toFixed(1)} önceki dönem</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const yL = padT + (H - padT - padB) * (1 - p)
          return (
            <g key={p}>
              <line x1={padL} y1={yL} x2={W - padR} y2={yL} stroke="var(--divider)" strokeWidth="1" strokeDasharray={p === 0 ? 'none' : '3,3'} />
              <text x={padL - 8} y={yL + 4} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="Geist Mono, monospace">
                ₺{Math.round(max * p / 1000)}K
              </text>
            </g>
          )
        })}
        <defs>
          <linearGradient id="gradAreaAn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111113" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#111113" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#gradAreaAn)" />
        <path d={line('prev')} fill="none" stroke="var(--text-4)" strokeWidth="1.5" strokeDasharray="5,3" />
        <path d={line('current')} fill="none" stroke="var(--text)" strokeWidth="2.5" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.current)} r="4" fill="#fff" stroke="var(--text)" strokeWidth="2" />
            {i === peakIdx && d.current > 0 && (
              <g>
                <rect x={x(i) - 32} y={y(d.current) - 30} width="64" height="22" rx="4" fill="var(--text)" />
                <text x={x(i)} y={y(d.current) - 15} fontSize="11" fontWeight="600" fill="#ffd089" textAnchor="middle" fontFamily="Geist Mono, monospace">
                  ₺{(d.current / 1000).toFixed(1)}K
                </text>
              </g>
            )}
            {i % tickStep === 0 && (
              <text x={x(i)} y={H - 8} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="Geist Mono, monospace">{d.date}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ── BIG HEATMAP ──────────────────────────────────── */
function BigHeatmap({ data }: { data: HeatmapCell[] }) {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

  const lookup = new Map<string, number>()
  let maxCount = 1
  for (const cell of data) {
    lookup.set(`${cell.day}-${cell.hour}`, cell.count)
    if (cell.count > maxCount) maxCount = cell.count
  }

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(15, 1fr)', gap: 3, alignItems: 'center' }}>
        <span />
        {Array.from({ length: 15 }, (_, h) => (
          <span key={h} style={{ fontSize: 9, color: 'var(--text-4)', textAlign: 'center', ...s.mono }}>
            {h + 8}
          </span>
        ))}
        {days.map((d, dayIdx) => (
          <Fragment key={d}>
            <span style={{ fontSize: 10, color: 'var(--text-3)', paddingRight: 6, fontWeight: 500 }}>{d}</span>
            {Array.from({ length: 15 }, (_, hIdx) => {
              const count = lookup.get(`${dayIdx}-${hIdx + 8}`) ?? 0
              const v = count / maxCount
              return (
                <div key={hIdx} style={{
                  aspectRatio: '1', borderRadius: 2,
                  background: v === 0 ? 'var(--surface-3)' : `rgba(31, 78, 143, ${Math.max(0.1, v)})`,
                }} />
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/* ── PAYMENT DONUT ────────────────────────────────── */
const PAYMENT_COLORS = ['#111113', '#2f6f4e', '#ffd089', '#1f4e8f', '#a13b7a']

function PaymentDonut({ segments }: { segments: PaymentBreakdown[] }) {
  const totalAmount = segments.reduce((sum, seg) => sum + seg.amount, 0)
  const totalCount = segments.reduce((sum, seg) => sum + seg.count, 0)
  const size = 160, stroke = 30, r = (size - stroke) / 2, C = 2 * Math.PI * r
  let offset = 0

  if (segments.length === 0 || totalAmount <= 0) {
    return (
      <div style={{ padding: '46px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Bu aralıkta tahsil edilmiş ödeme yok
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {segments.map((seg, i) => {
            const dash = (seg.amount / totalAmount) * C
            const el = (
              <circle key={seg.key} cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} strokeWidth={stroke}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return el
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...s.mono, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(totalAmount)}</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{totalCount} ödeme</span>
        </div>
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((seg, i) => (
          <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{seg.label}</span>
            <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-3)' }}>%{seg.pct.toLocaleString('tr-TR')}</span>
            <span style={{ ...s.mono, fontSize: 11.5, fontWeight: 600, minWidth: 74, textAlign: 'right', color: 'var(--text)' }}>{formatCurrency(seg.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── TOP ITEMS TABLE ──────────────────────────────── */
function TopItemsTable({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Bugün henüz sipariş yok
      </div>
    )
  }
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '32px 1fr 80px 110px',
        padding: '8px 16px', background: 'var(--surface-2)',
        borderBottom: '1px solid var(--divider)',
        fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase',
        alignItems: 'center', gap: 10,
      }}>
        <span>#</span><span>Ürün</span>
        <span style={{ textAlign: 'right' }}>Adet</span>
        <span style={{ textAlign: 'right' }}>Tutar</span>
      </div>
      {items.map((it, i) => (
        <div key={it.name} style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 80px 110px',
          padding: '10px 16px', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--divider)',
        }}>
          <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{i + 1}</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
          <span style={{ ...s.mono, fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{it.count}</span>
          <span style={{ ...s.mono, fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{formatCurrency(it.revenue)}</span>
        </div>
      ))}
    </div>
  )
}

/* ── PAYMENTS REPORT ──────────────────────────────── */
function PaymentsReport({ paymentBreakdown, range }: { paymentBreakdown: PaymentReport; range: string }) {
  const { collected, comp, collectedTotal, collectedCount } = paymentBreakdown
  const topMethod = collected[0] ?? null

  return (
    <div style={{ maxWidth: 1140 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Ödeme Raporu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>{rangeLabel(range)} · gerçek ödeme yöntemine göre · paid_at bazlı tahsilat</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <KPISmall label="Toplam tahsilat" value={formatCurrency(collectedTotal)} delta={`${collectedCount} ödeme`} />
        <KPISmall
          label="Ana yöntem"
          value={topMethod?.label ?? '—'}
          delta={topMethod ? `%${topMethod.pct.toLocaleString('tr-TR')}` : '—'}
        />
        {/* İkram (comp) — its OWN metric, ₺0 collected, never inside tahsilat. */}
        <KPISmall label="İkram edilen" value={formatCurrency(comp.amount)} delta={comp.count ? `${comp.count} adet · tahsilat dışı` : 'tahsilat dışı'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        <Card title="Dağılım" subtitle="Tahsil edilen tutara göre">
          <PaymentDonut segments={collected} />
        </Card>
        <Card title="Yöntem detayı" subtitle="Nakit · Fiziksel POS · İyzico">
          <PaymentRows rows={collected} />
          <CompLine comp={comp} />
        </Card>
      </div>
    </div>
  )
}

/* İkram (comp) line — rendered separately, with the P2 comp badge palette
   (violet, ₺0-collected). Deliberately OUTSIDE the collected breakdown/percent. */
function CompLine({ comp }: { comp: { amount: number; count: number } }) {
  if (comp.count === 0) return null
  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', border: '1px dashed #c4b5fd', borderRadius: 6, padding: '2px 8px' }}>İkram</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>Tahsilat dışı (₺0 toplanan)</span>
      <span style={{ ...s.mono, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(comp.amount)}</span>
      <span style={{ ...s.mono, fontSize: 11.5, color: 'var(--text-3)', minWidth: 56, textAlign: 'right' }}>{comp.count} adet</span>
    </div>
  )
}

function PaymentRows({ rows }: { rows: PaymentBreakdown[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '42px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Bu aralıkta tahsil edilmiş ödeme yok
      </div>
    )
  }

  const maxAmount = Math.max(...rows.map((row) => row.amount), 1)
  return (
    <div style={{ padding: 14 }}>
      {rows.map((row, i) => (
        <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 72px', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--divider)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{row.label}</span>
          <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(row.amount / maxAmount) * 100}%`, height: '100%', background: PAYMENT_COLORS[i % PAYMENT_COLORS.length], borderRadius: 999 }} />
          </div>
          <span style={{ ...s.mono, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(row.amount)}</span>
          <span style={{ ...s.mono, textAlign: 'right', fontSize: 11.5, color: 'var(--text-3)' }}>{row.count} adet</span>
        </div>
      ))}
    </div>
  )
}

/* ── ITEMS REPORT ─────────────────────────────────── */
function ItemsReport({ items, range }: { items: ProductReportItem[]; range: string }) {
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0)
  const totalCount = items.reduce((sum, item) => sum + item.count, 0)
  const classTotals = {
    A: items.filter((item) => item.abcClass === 'A').reduce((sum, item) => sum + item.revenue, 0),
    B: items.filter((item) => item.abcClass === 'B').reduce((sum, item) => sum + item.revenue, 0),
    C: items.filter((item) => item.abcClass === 'C').reduce((sum, item) => sum + item.revenue, 0),
  }

  return (
    <div style={{ maxWidth: 1140 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Ürün Performansı</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 22 }}>{rangeLabel(range)} · tahsil edilmiş siparişlerden</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <KPISmall label="Ürün tahsilatı" value={formatCurrency(totalRevenue)} delta="—" />
        <KPISmall label="Satılan adet" value={String(totalCount)} delta="—" />
        <KPISmall label="Ürün çeşidi" value={String(items.length)} delta="—" />
      </div>

      <Card title="ABC analizi" subtitle="Tahsilat payına göre sınıflandırma" style={{ marginBottom: 12 }}>
        <ABCAnalysis items={items} totalRevenue={totalRevenue} classTotals={classTotals} />
      </Card>

      <Card title="Ürün karması" subtitle="Tahsilat payı × hacim" style={{ marginBottom: 12 }}>
        <ItemMatrix items={items} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Yükselişte" subtitle="Önceki dönemle kıyas">
          <RisersList items={items} />
        </Card>
        <Card title="Düşüşte" subtitle="Önceki dönemle kıyas">
          <FallersList items={items} />
        </Card>
      </div>
    </div>
  )
}

function ABCAnalysis({
  items,
  totalRevenue,
  classTotals,
}: {
  items: ProductReportItem[]
  totalRevenue: number
  classTotals: Record<'A' | 'B' | 'C', number>
}) {
  if (items.length === 0 || totalRevenue <= 0) {
    return (
      <div style={{ padding: '42px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Bu aralıkta ürün tahsilatı yok
      </div>
    )
  }

  const bands: Array<{ key: 'A' | 'B' | 'C'; label: string; color: string }> = [
    { key: 'A', label: 'A', color: 'var(--positive)' },
    { key: 'B', label: 'B', color: 'var(--warning)' },
    { key: 'C', label: 'C', color: 'var(--text-4)' },
  ]

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 14, background: 'var(--surface-3)' }}>
        {bands.map((band) => {
          const pct = (classTotals[band.key] / totalRevenue) * 100
          if (pct <= 0) return null
          return (
            <div key={band.key} style={{ width: `${pct}%`, background: band.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10.5, fontWeight: 700 }}>
              {band.label} · %{Math.round(pct)}
            </div>
          )
        })}
      </div>
      <ProductTable items={items} />
    </div>
  )
}

function ProductTable({ items }: { items: ProductReportItem[] }) {
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '32px 1fr 70px 110px 70px 54px',
        padding: '8px 0', borderBottom: '1px solid var(--divider)',
        fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase',
        alignItems: 'center', gap: 10,
      }}>
        <span>#</span><span>Ürün</span>
        <span style={{ textAlign: 'right' }}>Adet</span>
        <span style={{ textAlign: 'right' }}>Tutar</span>
        <span style={{ textAlign: 'right' }}>Pay</span>
        <span style={{ textAlign: 'right' }}>Sınıf</span>
      </div>
      {items.slice(0, 10).map((item, i) => (
        <div key={item.name} style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 70px 110px 70px 54px',
          padding: '10px 0', alignItems: 'center', gap: 10,
          borderBottom: i === Math.min(items.length, 10) - 1 ? 'none' : '1px solid var(--divider)',
        }}>
          <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{i + 1}</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <span style={{ ...s.mono, fontSize: 12.5, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{item.count}</span>
          <span style={{ ...s.mono, fontSize: 12.5, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{formatCurrency(item.revenue)}</span>
          <span style={{ ...s.mono, fontSize: 12, textAlign: 'right', color: 'var(--text-3)' }}>%{item.sharePct.toLocaleString('tr-TR')}</span>
          <span style={{ ...s.mono, fontSize: 11, fontWeight: 700, textAlign: 'right', color: item.abcClass === 'A' ? 'var(--positive)' : item.abcClass === 'B' ? 'var(--warning)' : 'var(--text-3)' }}>{item.abcClass}</span>
        </div>
      ))}
    </div>
  )
}

function ItemMatrix({ items }: { items: ProductReportItem[] }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '42px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Bu aralıkta ürün verisi yok
      </div>
    )
  }

  const plotItems = items.slice(0, 14)
  const W = 1040, H = 260, padL = 50, padR = 24, padT = 16, padB = 36
  const xMax = Math.max(...plotItems.map((item) => item.count), 1)
  const yMax = Math.max(...plotItems.map((item) => item.sharePct), 1)
  const maxRevenue = Math.max(...plotItems.map((item) => item.revenue), 1)
  const px = (v: number) => padL + (v / xMax) * (W - padL - padR)
  const py = (v: number) => H - padB - (v / yMax) * (H - padT - padB)
  const tone = (cls: ProductReportItem['abcClass']) => cls === 'A' ? '#137a4d' : cls === 'B' ? '#f0b429' : '#b42318'
  const shortName = (name: string) => name.length > 14 ? `${name.slice(0, 13)}…` : name

  return (
    <div style={{ padding: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const yy = py(p)
          return (
            <g key={p}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="var(--divider)" strokeDasharray={p === 0 ? 'none' : '3,3'} />
              <text x={padL - 8} y={yy + 4} fontSize="10" fill="var(--text-3)" textAnchor="end" fontFamily="Geist Mono">%{Math.round(yMax * p)}</text>
            </g>
          )
        })}
        <line x1={padL} y1={py(yMax * 0.5)} x2={W - padR} y2={py(yMax * 0.5)} stroke="var(--text-4)" strokeDasharray="4,4" />
        <line x1={px(xMax * 0.5)} y1={padT} x2={px(xMax * 0.5)} y2={H - padB} stroke="var(--text-4)" strokeDasharray="4,4" />
        {plotItems.map((item) => {
          const r = 6 + (item.revenue / maxRevenue) * 18
          return (
          <g key={item.name}>
            <circle cx={px(item.count)} cy={py(item.sharePct)} r={r} fill={tone(item.abcClass)} opacity={0.56} stroke={tone(item.abcClass)} strokeWidth="1.5" />
            <text x={px(item.count)} y={py(item.sharePct) - r - 4} fontSize="10" fill="var(--text-2)" textAnchor="middle" fontWeight="500">{shortName(item.name)}</text>
          </g>
          )
        })}
        <text x={(W - padL - padR) / 2 + padL} y={H - 8} fontSize="10" fill="var(--text-3)" textAnchor="middle">Hacim (adet) →</text>
        <text x={14} y={(H - padT - padB) / 2 + padT} fontSize="10" fill="var(--text-3)" textAnchor="middle" transform={`rotate(-90 14 ${(H - padT - padB) / 2 + padT})`}>Tahsilat payı %</text>
      </svg>
    </div>
  )
}

function formatProductDelta(delta: number | null): string {
  if (delta === null) return 'Yeni'
  return `${delta >= 0 ? '+' : ''}${delta.toLocaleString('tr-TR')}%`
}

function RisersList({ items }: { items: ProductReportItem[] }) {
  const risers = items
    .filter((item) => item.deltaPct === null || item.deltaPct > 0)
    .sort((a, b) => (b.deltaPct ?? 999) - (a.deltaPct ?? 999))
    .slice(0, 4)

  if (risers.length === 0) {
    return <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Yükselen ürün yok</div>
  }

  return (
    <div style={{ padding: 12 }}>
      {risers.map((it, i, arr) => (
        <div key={i} style={{
          padding: '10px 6px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--divider)',
        }}>
          <span style={{ ...s.mono, fontSize: 10.5, width: 22, textAlign: 'center', color: 'var(--text-3)' }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{it.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{formatCurrency(it.revenue)} · {it.count} adet</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 8px', borderRadius: 999,
            background: 'var(--positive-bg)', color: 'var(--positive)',
            fontSize: 11, fontWeight: 600,
          }}>↑ {formatProductDelta(it.deltaPct)}</span>
        </div>
      ))}
    </div>
  )
}

function FallersList({ items }: { items: ProductReportItem[] }) {
  const fallers = items
    .filter((item) => item.deltaPct !== null && item.deltaPct < 0)
    .sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0))
    .slice(0, 4)

  if (fallers.length === 0) {
    return <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Düşen ürün yok</div>
  }

  return (
    <div style={{ padding: 12 }}>
      {fallers.map((it, i, arr) => (
        <div key={i} style={{
          padding: '10px 6px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--divider)',
        }}>
          <span style={{ ...s.mono, fontSize: 10.5, width: 22, textAlign: 'center', color: 'var(--text-3)' }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{it.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{formatCurrency(it.revenue)} · {it.count} adet</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 8px', borderRadius: 999,
            background: 'var(--critical-bg)', color: 'var(--critical)',
            fontSize: 11, fontWeight: 600,
          }}>↓ {formatProductDelta(it.deltaPct)}</span>
        </div>
      ))}
    </div>
  )
}

/* ── TABLES REPORT ─────────────────────────────────── */
function TablesReport({ tables }: { tables: TableReportRow[] }) {
  if (tables.length === 0) {
    return (
      <div style={{ maxWidth: 1140 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Masa Performansı</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 22 }}>Son 7 günlük tahsilat</p>
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Henüz masa verisi yok</div>
      </div>
    )
  }

  const sorted = [...tables].sort((a, b) => b.revenue - a.revenue)
  const maxRev = Math.max(...sorted.map(t => t.revenue), 1)
  const totalRevenue = sorted.reduce((s, t) => s + t.revenue, 0)
  const totalOrders = sorted.reduce((s, t) => s + t.orders, 0)
  const activeTables = sorted.filter(t => t.orders > 0).length

  return (
    <div style={{ maxWidth: 1140 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Masa Performansı</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 22 }}>
        {tables.length} masa · Son 7 günlük doluluk ve tahsilat
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <KPISmall label="Aktif masa" value={String(activeTables)} delta="—" />
        <KPISmall label="Ödemeli sipariş" value={String(totalOrders)} delta="—" />
        <KPISmall label="Toplam tahsilat" value={formatCurrency(totalRevenue)} delta="—" />
        <KPISmall label="Ort. masa tahsilatı"
          value={activeTables > 0 ? formatCurrency(Math.round(totalRevenue / activeTables)) : '—'}
          delta="—"
        />
      </div>

      <Card title="Masa tahsilatı" subtitle="7 günlük toplam · masa başı" style={{ marginBottom: 12 }}>
        <div style={{ padding: 14 }}>
          {sorted.map((t, i) => {
            const pct = (t.revenue / maxRev) * 100
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 700, width: 38, ...s.mono }}>{t.label}</span>
                <div style={{ flex: 1, position: 'relative', height: 18, background: 'var(--surface-3)', borderRadius: 9, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%',
                    background: i === 0 ? '#ffd089' : i < 3 ? 'var(--positive)' : i < 8 ? 'var(--info)' : 'var(--text-3)',
                    borderRadius: 9,
                  }} />
                </div>
                <span style={{ ...s.mono, fontSize: 11.5, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                  {t.revenue > 0 ? `₺${(t.revenue / 1000).toFixed(1)}K` : '—'}
                </span>
                <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-3)', minWidth: 50, textAlign: 'right' }}>
                  {t.orders} ödeme
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ── SHARED: CARD ─────────────────────────────────── */
function Card({ title, subtitle, children, style }: {
  title: string; subtitle?: string; children: ReactNode; style?: CSSProperties
}) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden', ...style,
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
      </div>
      <div>{children}</div>
    </div>
  )
}
