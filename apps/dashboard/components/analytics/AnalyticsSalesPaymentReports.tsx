'use client'

import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'
import type { DashboardKPIs, DailySale, HeatmapCell, PaymentBreakdown, PaymentReport, TopItem } from '../../lib/queries'
import { formatCurrency } from '../../lib/utils'
import HeatmapGrid from './chart-primitives/HeatmapGrid'
import { AnalyticsCard, AnalyticsKpi } from './AnalyticsReportPrimitives'
import {
  analyticsRangeLabel as rangeLabel,
  analyticsRangePeriodLabel as rangePeriodLabel,
} from './analytics-report-model'

const chartLoading = (height: number) => () => (
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 12 }}>Grafik yükleniyor…</div>
)
const SalesLineChart = dynamic(() => import('./chart-primitives/SalesLineChart'), { ssr: false, loading: chartLoading(300) })
const PaymentDonutChart = dynamic(() => import('./chart-primitives/PaymentDonutChart'), { ssr: false, loading: chartLoading(240) })
const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }


/* ── SALES REPORT ─────────────────────────────────── */
function delta(current: number, prev: number): { text: string; down: boolean } {
  if (prev === 0) return { text: current > 0 ? 'Yeni' : '—', down: false }
  const pct = ((current - prev) / prev) * 100
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, down: pct < 0 }
}
export function AnalyticsSalesReport({
  kpis,
  topItems,
  salesOverTime,
  heatmapData,
  paymentBreakdown,
  range,
}: {
  kpis: DashboardKPIs
  topItems: TopItem[]
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  paymentBreakdown: PaymentReport
  range: string
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
        <AnalyticsKpi label="Tahsil edilen"  value={formatCurrency(kpis.revenue)}   delta={revDelta.text} down={revDelta.down} />
        <AnalyticsKpi label="Sipariş hacmi"  value={String(kpis.orders)}            delta={ordDelta.text} down={ordDelta.down} />
        <AnalyticsKpi label="Ort. tahsilat"  value={formatCurrency(kpis.avgBasket)} delta="—" />
        <AnalyticsKpi label="Oturum"         value={String(kpis.sessions)}          delta={sesDelta.text} down={sesDelta.down} />
        <AnalyticsKpi label="Aktif sipariş"  value={String(kpis.activeOrders)}      delta="—" />
      </div>

      <AnalyticsCard title="Tahsilat trendi" subtitle="Seçili dönem · paid_at bazlı" style={{ marginBottom: 12, overflow: 'visible' }}>
        <SalesLineChart data={salesOverTime} range={range} />
      </AnalyticsCard>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
        <AnalyticsCard title="Saat × Gün ısı haritası" subtitle="Son 30 gün · sipariş yoğunluğu">
          <HeatmapGrid data={heatmapData} />
        </AnalyticsCard>
        <AnalyticsCard title="Ödeme dağılımı" subtitle="Yöntem başına tahsilat" style={{ overflow: 'visible' }}>
          <PaymentDonutChart segments={paymentBreakdown.collected} />
          {/* İkram (comp) surfaced here for visibility — EXCLUDED from the
              collected donut/ciro, shown alongside as context. Full detail lives
              in the Ödemeler report. */}
          {paymentBreakdown.comp.count > 0 && (
            <div style={{ padding: '0 16px 14px', marginTop: -2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', border: '1px dashed #c4b5fd', borderRadius: 6, padding: '2px 7px' }}>İkram</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                İkram edilen {formatCurrency(paymentBreakdown.comp.amount)} · tahsilat dışı
              </span>
            </div>
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="En çok satan ürünler" subtitle={`${rangePeriodLabel(range)} · tahsil edilmiş siparişler`}>
        <TopItemsTable items={topItems} period={rangePeriodLabel(range)} />
      </AnalyticsCard>
    </div>
  )
}

/* ── KPI SMALL ────────────────────────────────────── */


/* ── PAYMENT DONUT ────────────────────────────────── */
const PAYMENT_COLORS = ['var(--chart-cat-1)', 'var(--chart-cat-2)', 'var(--chart-cat-3)', 'var(--chart-cat-4)', 'var(--chart-cat-5)']

/* ── TOP ITEMS TABLE ──────────────────────────────── */
function TopItemsTable({ items, period }: { items: TopItem[]; period: string }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        {period} için tahsil edilmiş sipariş yok
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
export function AnalyticsPaymentsReport({ paymentBreakdown, range }: { paymentBreakdown: PaymentReport; range: string }) {
  const { collected, comp, collectedTotal, collectedCount } = paymentBreakdown
  const topMethod = collected[0] ?? null

  return (
    <div style={{ maxWidth: 1140 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Ödeme Raporu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>{rangeLabel(range)} · gerçek ödeme yöntemine göre · paid_at bazlı tahsilat</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <AnalyticsKpi label="Toplam tahsilat" value={formatCurrency(collectedTotal)} delta={`${collectedCount} ödeme`} />
        <AnalyticsKpi
          label="Ana yöntem"
          value={topMethod?.label ?? '—'}
          delta={topMethod ? `%${topMethod.pct.toLocaleString('tr-TR')}` : '—'}
        />
        {/* İkram (comp) — its OWN metric, ₺0 collected, never inside tahsilat. */}
        <AnalyticsKpi label="İkram edilen" value={formatCurrency(comp.amount)} delta={comp.count ? `${comp.count} adet · tahsilat dışı` : 'tahsilat dışı'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        <AnalyticsCard title="Dağılım" subtitle="Tahsil edilen tutara göre" style={{ overflow: 'visible' }}>
          <PaymentDonutChart segments={collected} />
        </AnalyticsCard>
        <AnalyticsCard title="Yöntem detayı" subtitle="Nakit · Fiziksel POS · İyzico · Hesap bölüşme">
          <PaymentRows rows={collected} />
          <CompLine comp={comp} />
        </AnalyticsCard>
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
