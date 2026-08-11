'use client'

import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'
import type { AnalyticsRangeKPIs, DailySale, HeatmapCell, PaymentBreakdown, PaymentReport, TopItem } from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import HeatmapGrid from './chart-primitives/HeatmapGrid'
import { loadAnalyticsChart } from './chart-primitives/load-analytics-chart'
import { AnalyticsCard, AnalyticsKpi } from './AnalyticsReportPrimitives'
import {
  analyticsRangePeriodLabel as rangePeriodLabel,
  analyticsPreviousPeriodLabel,
} from './analytics-report-model'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

const chartLoading = (height: number) => () => (
  <div role="status" aria-live="polite" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 12 }}>Grafik yükleniyor…</div>
)
const SalesLineChart = dynamic(() => loadAnalyticsChart(() => import('./chart-primitives/SalesLineChart')), { ssr: false, loading: chartLoading(300) })
const PaymentDonutChart = dynamic(() => loadAnalyticsChart(() => import('./chart-primitives/PaymentDonutChart')), { ssr: false, loading: chartLoading(240) })
const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }


/* ── SALES REPORT ─────────────────────────────────── */
function delta(current: number, prev: number): { text: string; down: boolean } {
  if (prev === 0) return { text: current > 0 ? 'Yeni' : '—', down: false }
  const pct = ((current - prev) / prev) * 100
  return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, down: pct < 0 }
}
export function AnalyticsSalesReport({
  rangeKpis,
  liveActiveOrders,
  topItems,
  salesOverTime,
  heatmapData,
  paymentBreakdown,
  query,
}: {
  rangeKpis: AnalyticsRangeKPIs
  liveActiveOrders: number
  topItems: TopItem[]
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  paymentBreakdown: PaymentReport
  query: AnalyticsQuery
}) {
  const revDelta = delta(rangeKpis.revenue, rangeKpis.previousRevenue)
  const ordDelta = delta(rangeKpis.orders, rangeKpis.previousOrders)
  const sesDelta = delta(rangeKpis.sessions, rangeKpis.previousSessions)
  const period = rangePeriodLabel(query)
  const comparison = analyticsPreviousPeriodLabel(query)

  return (
    <div style={{ maxWidth: 1140 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Satış Raporu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>
          {period} · {comparison}
        </p>
      </div>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
        <AnalyticsKpi label={`${period} tahsilatı`} value={formatCurrency(rangeKpis.revenue)} delta={revDelta.text} down={revDelta.down} hint={comparison} />
        <AnalyticsKpi label={`${period} sipariş hacmi`} value={String(rangeKpis.orders)} delta={ordDelta.text} down={ordDelta.down} hint={comparison} />
        <AnalyticsKpi label={`${period} ort. tahsilat`} value={formatCurrency(rangeKpis.avgBasket)} delta={`${rangeKpis.paidOrders} ödeme`} direction="flat" tone="neutral" />
        <AnalyticsKpi label={`${period} oturum`} value={String(rangeKpis.sessions)} delta={sesDelta.text} down={sesDelta.down} hint={comparison} />
      </div>

      <div role="note" style={{ marginBottom: 16, padding: '9px 12px', border: '1px solid var(--divider)', borderRadius: 9, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 11.5 }}>
        <strong style={{ color: 'var(--text)' }}>Canlı durum:</strong> Bugün açılmış {liveActiveOrders} aktif sipariş var. Bu anlık değer seçili dönem KPI’larına dahil değildir.
      </div>

      <AnalyticsCard title="Tahsilat trendi" subtitle="Seçili dönem · paid_at bazlı" style={{ marginBottom: 12, overflow: 'visible' }}>
        <SalesLineChart data={salesOverTime} range={query.range} />
      </AnalyticsCard>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
        <AnalyticsCard title="Saat × Gün ısı haritası" subtitle={`${period} · sipariş yoğunluğu`}>
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

      <AnalyticsCard title="En çok satan ürünler" subtitle={`${rangePeriodLabel(query)} · tahsil edilmiş siparişler`}>
        <TopItemsTable items={topItems} period={rangePeriodLabel(query)} />
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
      <Empty className="min-h-32"><EmptyHeader><EmptyTitle>Tahsil edilmiş sipariş yok</EmptyTitle><EmptyDescription>{period} için ürün performansı oluşmadı.</EmptyDescription></EmptyHeader></Empty>
    )
  }
  return (
    <div className="analytics-table-scroll" role="region" aria-label="En çok satan ürünler tablosu" tabIndex={0}>
      <Table className="min-w-[430px]">
        <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Ürün</TableHead><TableHead className="text-right">Adet</TableHead><TableHead className="text-right">Tutar</TableHead></TableRow></TableHeader>
        <TableBody>{items.map((item, index) => (
          <TableRow key={item.name}>
            <TableCell style={s.mono} className="text-xs text-muted-foreground">{index + 1}</TableCell>
            <TableCell className="max-w-72 truncate font-medium">{item.name}</TableCell>
            <TableCell style={s.mono} className="text-right font-medium tabular-nums">{item.count}</TableCell>
            <TableCell style={s.mono} className="text-right font-medium tabular-nums">{formatCurrency(item.revenue)}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  )
}

/* ── PAYMENTS REPORT ──────────────────────────────── */
export function AnalyticsPaymentsReport({ paymentBreakdown, query }: { paymentBreakdown: PaymentReport; query: AnalyticsQuery }) {
  const { collected, comp, collectedTotal, collectedCount, financials, refunds } = paymentBreakdown
  const refundsAvailable = paymentBreakdown.coverage.monetaryRefunds

  return (
    <div style={{ maxWidth: 1140 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Ödeme Raporu</h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 0 }}>{rangePeriodLabel(query)} · gerçek ödeme yöntemine göre · paid_at bazlı tahsilat</p>
      </div>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 12 }}>
        <AnalyticsKpi label="Toplam tahsilat" value={formatCurrency(collectedTotal)} delta={`${collectedCount} ödeme`} />
        <AnalyticsKpi label="Parasal iade" value={refundsAvailable ? formatCurrency(refunds.total) : '—'} delta={refundsAvailable ? `${refunds.fullCount} tam · ${refunds.partialCount} kısmi` : 'veri kaynağı kullanılamıyor'} direction="flat" tone={refundsAvailable ? undefined : 'critical'} />
        <AnalyticsKpi label="İade sonrası net tahsilat" value={refundsAvailable ? formatCurrency(refunds.netCollected) : '—'} delta={refundsAvailable ? 'tahsilat − başarılı iade' : 'finansal karar için kullanmayın'} direction="flat" tone={refundsAvailable ? undefined : 'critical'} />
        {/* İkram (comp) — its OWN metric, ₺0 collected, never inside tahsilat. */}
        <AnalyticsKpi label="İkram edilen" value={formatCurrency(comp.amount)} delta={comp.count ? `${comp.count} adet · tahsilat dışı` : 'tahsilat dışı'} />
      </div>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 12 }}>
        <AnalyticsKpi label="Brüt ürün satışı" value={formatCurrency(financials.grossSales)} delta="satır fiyatlarından" />
        <AnalyticsKpi label="İndirim" value={formatCurrency(financials.discountTotal)} delta="brüt − sipariş toplamı" />
        <AnalyticsKpi
          label="İndirim sonrası satış"
          value={formatCurrency(financials.netSales)}
          delta={financials.unattributedAmount > 0
            ? `${formatCurrency(financials.unattributedAmount)} ürün dışı tutar`
            : 'sipariş toplamları'}
        />
        <AnalyticsKpi
          label="Hesaplanan KDV"
          value={formatCurrency(financials.vatTotal)}
          delta={financials.unknownVatGross > 0
            ? `${formatCurrency(financials.unknownVatGross)} KDV oranı eksik`
            : `${formatCurrency(financials.netOfVatTotal)} KDV hariç`}
        />
      </div>

      <Alert className="mb-3" role="note">
        <AlertTitle>{refundsAvailable ? 'Finansal kapsam' : 'İade defteri okunamıyor'}</AlertTitle>
        <AlertDescription>
          {!refundsAvailable && <>İade ve net tahsilat alanları şu an kullanılamaz. </>}
          Servis ücreti ve bahşiş için ayrı kaynak alanları bulunmadığından bu iki tutar rapora dahil değildir. Ürün finansalı tahakkuk görünümüdür{refundsAvailable ? '; iade sonrası nakit sonuç için “İade sonrası net tahsilat” kullanılır.' : '.'}
        </AlertDescription>
      </Alert>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        <AnalyticsCard title="Dağılım" subtitle="Tahsil edilen tutara göre" style={{ overflow: 'visible' }}>
          <PaymentDonutChart segments={collected} />
        </AnalyticsCard>
        <AnalyticsCard title="Yöntem detayı" subtitle="Nakit · Fiziksel POS · İyzico · Hesap bölüşme">
          <PaymentRows rows={collected} />
          <CompLine comp={comp} />
          {refundsAvailable && refunds.byMethod.map((row) => (
            <div key={`refund-${row.key}`} style={{ padding: '10px 14px', borderTop: '1px solid var(--divider)', display: 'flex', gap: 10, fontSize: 12 }}>
              <span style={{ flex: 1, color: 'var(--critical)' }}>{row.label} iadesi</span>
              <span style={{ ...s.mono, fontWeight: 700 }}>−{formatCurrency(row.amount)}</span>
              <span style={{ ...s.mono, color: 'var(--text-3)' }}>{row.count} adet</span>
            </div>
          ))}
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
      <Badge variant="secondary">İkram</Badge>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>Tahsilat dışı (₺0 toplanan)</span>
      <span style={{ ...s.mono, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(comp.amount)}</span>
      <span style={{ ...s.mono, fontSize: 11.5, color: 'var(--text-3)', minWidth: 56, textAlign: 'right' }}>{comp.count} adet</span>
    </div>
  )
}

function PaymentRows({ rows }: { rows: PaymentBreakdown[] }) {
  if (rows.length === 0) {
    return (
      <Empty className="min-h-32"><EmptyHeader><EmptyTitle>Tahsil edilmiş ödeme yok</EmptyTitle><EmptyDescription>Seçili aralıkta ödeme yöntemi dağılımı oluşmadı.</EmptyDescription></EmptyHeader></Empty>
    )
  }

  const maxAmount = Math.max(...rows.map((row) => row.amount), 1)
  return (
    <div className="analytics-table-scroll" role="region" aria-label="Ödeme yöntemi detayları" tabIndex={0} style={{ padding: 14 }}>
      <div style={{ minWidth: 440 }}>
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
    </div>
  )
}
