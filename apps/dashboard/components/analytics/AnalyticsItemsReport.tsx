'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ProductReportItem } from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { AnalyticsCard as Card, AnalyticsKpi as KPISmall } from './AnalyticsReportPrimitives'
import { loadAnalyticsChart } from './chart-primitives/load-analytics-chart'
import { analyticsRangePeriodLabel as rangePeriodLabel } from './analytics-report-model'
import {
  formatProductDelta,
  projectProductReport,
  selectProductMovers,
} from './analytics-items-model'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

const chartLoading = () => (
  <div role="status" aria-live="polite" style={{ height: 272, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 12 }}>Grafik yükleniyor…</div>
)
const ProductScatterChart = dynamic(() => loadAnalyticsChart(() => import('./chart-primitives/ProductScatterChart')), { ssr: false, loading: chartLoading })
const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }

export function AnalyticsItemsReport({ items, query }: { items: ProductReportItem[]; query: AnalyticsQuery }) {
  const { totalRevenue, totalCount, classTotals } = projectProductReport(items)
  const movers = selectProductMovers(items)

  return (
    <div style={{ maxWidth: 1140 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Ürün Performansı</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 22 }}>{rangePeriodLabel(query)} · tahsil edilmiş siparişlerden</p>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
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

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
  const [sort, setSort] = useState<'revenue' | 'count' | 'name'>('revenue')
  const [direction, setDirection] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ProductReportItem | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pageSize = 5
  const sorted = useMemo(() => [...items].sort((left, right) => {
    const result = sort === 'name'
      ? left.name.localeCompare(right.name, 'tr')
      : left[sort] - right[sort]
    return direction === 'asc' ? result : -result
  }), [direction, items, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize)

  const writeTableState = (patch: Record<string, string | null>, push = false) => {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) url.searchParams.delete(key)
      else url.searchParams.set(key, value)
    }
    const nextUrl = `${url.pathname}${url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : ''}`
    window.history[push ? 'pushState' : 'replaceState'](null, '', nextUrl)
  }

  useEffect(() => {
    const applyUrlState = () => {
      const params = new URLSearchParams(window.location.search)
      const requestedSort = params.get('sort')
      const requestedDirection = params.get('dir')
      const requestedPage = Number(params.get('page'))
      const requestedDetail = params.get('detail')
      if (requestedSort === 'revenue' || requestedSort === 'count' || requestedSort === 'name') setSort(requestedSort)
      if (requestedDirection === 'asc' || requestedDirection === 'desc') setDirection(requestedDirection)
      if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= pageCount) setPage(requestedPage)
      setSelected(requestedDetail ? items.find((item) => item.name === requestedDetail) ?? null : null)
    }
    applyUrlState()
    window.addEventListener('popstate', applyUrlState)
    return () => window.removeEventListener('popstate', applyUrlState)
  }, [items, pageCount])

  useEffect(() => {
    if (selected && !dialogRef.current?.open) dialogRef.current?.showModal()
    else if (!selected && dialogRef.current?.open) dialogRef.current.close()
  }, [selected])

  const closeDetail = () => {
    setSelected(null)
    writeTableState({ detail: null })
  }

  return (
    <div>
      <div className="analytics-data-table-controls">
        <label>
          Sırala
          <select value={sort} onChange={(event) => {
            const next = event.target.value as typeof sort
            setSort(next); setPage(1); writeTableState({ sort: next, page: null })
          }}>
            <option value="revenue">Tutar</option>
            <option value="count">Adet</option>
            <option value="name">Ürün adı</option>
          </select>
        </label>
        <button type="button" onClick={() => {
          const next = direction === 'desc' ? 'asc' : 'desc'
          setDirection(next); setPage(1); writeTableState({ dir: next, page: null })
        }} aria-label={direction === 'desc' ? 'Artan sıraya geç' : 'Azalan sıraya geç'}>
          {direction === 'desc' ? 'Azalan ↓' : 'Artan ↑'}
        </button>
      </div>
      <div className="analytics-table-scroll" role="region" aria-label="ABC ürün analizi tablosu" tabIndex={0}>
      <div style={{ minWidth: 700 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '32px 1fr 70px 110px 70px 54px 76px',
        padding: '8px 0', borderBottom: '1px solid var(--divider)',
        fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase',
        alignItems: 'center', gap: 10,
      }}>
        <span>#</span><span>Ürün</span>
        <span style={{ textAlign: 'right' }}>Adet</span>
        <span style={{ textAlign: 'right' }}>Tutar</span>
        <span style={{ textAlign: 'right' }}>Pay</span>
        <span style={{ textAlign: 'right' }}>Sınıf</span><span />
      </div>
      {visible.map((item, i) => (
        <div key={item.name} style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 70px 110px 70px 54px 76px',
          padding: '10px 0', alignItems: 'center', gap: 10,
          borderBottom: i === visible.length - 1 ? 'none' : '1px solid var(--divider)',
        }}>
          <span style={{ ...s.mono, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{(page - 1) * pageSize + i + 1}</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <span style={{ ...s.mono, fontSize: 12.5, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{item.count}</span>
          <span style={{ ...s.mono, fontSize: 12.5, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{formatCurrency(item.revenue)}</span>
          <span style={{ ...s.mono, fontSize: 12, textAlign: 'right', color: 'var(--text-3)' }}>%{item.sharePct.toLocaleString('tr-TR')}</span>
          <span style={{ ...s.mono, fontSize: 11, fontWeight: 700, textAlign: 'right', color: item.abcClass === 'A' ? 'var(--positive)' : item.abcClass === 'B' ? 'var(--warning)' : 'var(--text-3)' }}>{item.abcClass}</span>
          <button type="button" className="analytics-table-detail-button" onClick={() => {
            setSelected(item); writeTableState({ detail: item.name }, true)
          }}>Detay</button>
        </div>
      ))}
      </div>
      </div>
      <div className="analytics-pagination" aria-label="Ürün tablosu sayfaları">
        <button type="button" disabled={page <= 1} onClick={() => {
          const next = page - 1; setPage(next); writeTableState({ page: next === 1 ? null : String(next) })
        }}>Önceki</button>
        <span>{page} / {pageCount}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => {
          const next = page + 1; setPage(next); writeTableState({ page: String(next) })
        }}>Sonraki</button>
      </div>
      <dialog ref={dialogRef} className="analytics-detail-dialog" onClose={closeDetail} aria-labelledby="analytics-product-detail-title">
        {selected && (
          <div>
            <div id="analytics-product-detail-title" role="heading" aria-level={2}>{selected.name}</div>
            <dl>
              <div><dt>Adet</dt><dd>{selected.count}</dd></div>
              <div><dt>Tutar</dt><dd>{formatCurrency(selected.revenue)}</dd></div>
              <div><dt>Tahsilat payı</dt><dd>%{selected.sharePct.toLocaleString('tr-TR')}</dd></div>
              <div><dt>ABC sınıfı</dt><dd>{selected.abcClass}</dd></div>
              <div><dt>Önceki dönem değişimi</dt><dd>{formatProductDelta(selected.deltaPct)}</dd></div>
            </dl>
            <button type="button" onClick={() => dialogRef.current?.close()}>Kapat</button>
          </div>
        )}
      </dialog>
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
