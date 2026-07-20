'use client'

import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'
import type { ProductReportItem } from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { AnalyticsCard as Card, AnalyticsKpi as KPISmall } from './AnalyticsReportPrimitives'
import { analyticsRangeLabel as rangeLabel } from './analytics-report-model'
import {
  formatProductDelta,
  projectProductReport,
  selectProductMovers,
} from './analytics-items-model'

const chartLoading = () => (
  <div style={{ height: 272, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 12 }}>Grafik yükleniyor…</div>
)
const ProductScatterChart = dynamic(() => import('./chart-primitives/ProductScatterChart'), { ssr: false, loading: chartLoading })
const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }

export function AnalyticsItemsReport({ items, range }: { items: ProductReportItem[]; range: string }) {
  const { totalRevenue, totalCount, classTotals } = projectProductReport(items)
  const movers = selectProductMovers(items)

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

      <Card title="Ürün karması" subtitle="Tahsilat payı × hacim" style={{ marginBottom: 12, overflow: 'visible' }}>
        <ProductScatterChart items={items} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Yükselişte" subtitle="Önceki dönemle kıyas">
          <RisersList items={movers.risers} />
        </Card>
        <Card title="Düşüşte" subtitle="Önceki dönemle kıyas">
          <FallersList items={movers.fallers} />
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

function RisersList({ items }: { items: ProductReportItem[] }) {
  if (items.length === 0) {
    return <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Yükselen ürün yok</div>
  }

  return (
    <div style={{ padding: 12 }}>
      {items.map((it, i, arr) => (
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
  if (items.length === 0) {
    return <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Düşen ürün yok</div>
  }

  return (
    <div style={{ padding: 12 }}>
      {items.map((it, i, arr) => (
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
