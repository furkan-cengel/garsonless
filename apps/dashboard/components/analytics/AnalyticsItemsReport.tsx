'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { ProductReportItem } from '../../lib/queries/analytics'
import { formatCurrency } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
import { Field, FieldLabel } from '../ui/field'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { AnalyticsCard as Card, AnalyticsKpi as KPISmall } from './AnalyticsReportPrimitives'
import { loadAnalyticsChart } from './chart-primitives/load-analytics-chart'
import { analyticsRangePeriodLabel as rangePeriodLabel } from './analytics-report-model'
import {
  formatProductDelta,
  projectProductReport,
  selectProductMovers,
} from './analytics-items-model'
import { readProductTableState, writeProductTableUrl } from './analytics-report-navigation'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'

const chartLoading = () => (
  <div role="status" aria-live="polite" style={{ height: 272, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 12 }}>Grafik yükleniyor…</div>
)
const ProductScatterChart = dynamic(() => loadAnalyticsChart(() => import('./chart-primitives/ProductScatterChart')), { ssr: false, loading: chartLoading })
const s = { mono: { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties }

export function AnalyticsItemsReport({ items, query }: { items: ProductReportItem[]; query: AnalyticsQuery }) {
  const { totalRevenue, totalCount, productCount, classTotals } = projectProductReport(items)
  const movers = selectProductMovers(items)

  return (
    <div style={{ maxWidth: 1140 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--text)' }}>Ürün Performansı</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, marginBottom: 22 }}>{rangePeriodLabel(query)} · tahsil edilmiş siparişlerden</p>

      <div className="analytics-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <KPISmall label="Ürün tahsilatı" value={formatCurrency(totalRevenue)} delta="—" />
        <KPISmall label="Satılan adet" value={String(totalCount)} delta="—" />
        <KPISmall label="Ürün çeşidi" value={String(productCount)} delta="—" />
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

const PRODUCT_SORT_LABELS = {
  revenue: 'Tutar',
  count: 'Adet',
  name: 'Ürün adı',
} as const
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
      <Empty className="min-h-36">
        <EmptyHeader>
          <EmptyTitle>Ürün tahsilatı yok</EmptyTitle>
          <EmptyDescription>Seçili tarih aralığında tahsil edilmiş ürün bulunamadı.</EmptyDescription>
        </EmptyHeader>
      </Empty>
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
  const pageSize = 5
  const sorted = useMemo(() => [...items].sort((left, right) => {
    const result = sort === 'name'
      ? left.name.localeCompare(right.name, 'tr')
      : left[sort] - right[sort]
    return direction === 'asc' ? result : -result
  }), [direction, items, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    const applyUrlState = () => {
      const state = readProductTableState(window.location.search, pageCount)
      setSort(state.sort)
      setDirection(state.direction)
      setPage(state.page)
      setSelected(state.detail ? items.find((item) => item.name === state.detail) ?? null : null)
      const params = new URLSearchParams(window.location.search)
      if (params.has('page') && params.get('page') !== String(state.page)) {
        writeProductTableUrl({ page: state.page === 1 ? null : String(state.page) })
      }
    }
    applyUrlState()
    window.addEventListener('popstate', applyUrlState)
    return () => window.removeEventListener('popstate', applyUrlState)
  }, [items, pageCount])

  const closeDetail = () => {
    setSelected(null)
    writeProductTableUrl({ detail: null })
  }

  return (
    <div>
      <div className="analytics-data-table-controls">
        <Field orientation="horizontal" className="w-auto gap-2">
          <FieldLabel>Sırala</FieldLabel>
          <Select value={sort} onValueChange={(value) => {
            if (!value) return
            const next = value as typeof sort
            setSort(next); setPage(1); writeProductTableUrl({ sort: next, page: null })
          }}>
            <SelectTrigger size="sm" aria-label="Ürün tablosu sıralama alanı"><SelectValue>{PRODUCT_SORT_LABELS[sort]}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="revenue">Tutar</SelectItem>
                <SelectItem value="count">Adet</SelectItem>
                <SelectItem value="name">Ürün adı</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Button variant="outline" size="sm" type="button" onClick={() => {
          const next = direction === 'desc' ? 'asc' : 'desc'
          setDirection(next); setPage(1); writeProductTableUrl({ dir: next, page: null })
        }} aria-label={direction === 'desc' ? 'Artan sıraya geç' : 'Azalan sıraya geç'}>
          {direction === 'desc' ? 'Azalan ↓' : 'Artan ↑'}
        </Button>
      </div>
      <div className="analytics-table-scroll" role="region" aria-label="ABC ürün analizi tablosu" tabIndex={0}>
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Ürün</TableHead>
              <TableHead className="text-right">Adet</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead className="text-right">Pay</TableHead>
              <TableHead className="text-right">Sınıf</TableHead>
              <TableHead className="w-20"><span className="sr-only">İşlem</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item, index) => (
              <TableRow key={item.name}>
                <TableCell style={s.mono} className="text-xs text-muted-foreground">{(page - 1) * pageSize + index + 1}</TableCell>
                <TableCell className="max-w-64 truncate font-medium">{item.name}</TableCell>
                <TableCell style={s.mono} className="text-right font-medium tabular-nums">{item.count}</TableCell>
                <TableCell style={s.mono} className="text-right font-medium tabular-nums">{formatCurrency(item.revenue)}</TableCell>
                <TableCell style={s.mono} className="text-right text-muted-foreground tabular-nums">%{item.sharePct.toLocaleString('tr-TR')}</TableCell>
                <TableCell className="text-right"><Badge variant={item.abcClass === 'A' ? 'positive' : item.abcClass === 'B' ? 'warning' : 'secondary'}>{item.abcClass}</Badge></TableCell>
                <TableCell><Button type="button" variant="ghost" size="xs" className="analytics-table-detail-button" aria-label={`${item.name} ürün detayını aç`} onClick={() => {
                  setSelected(item); writeProductTableUrl({ detail: item.name }, true)
                }}>Detay</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="analytics-pagination" aria-label="Ürün tablosu sayfaları">
        <Button variant="outline" size="sm" type="button" disabled={page <= 1} onClick={() => {
          const next = page - 1; setPage(next); writeProductTableUrl({ page: next === 1 ? null : String(next) })
        }}>Önceki</Button>
        <span>{page} / {pageCount}</span>
        <Button variant="outline" size="sm" type="button" disabled={page >= pageCount} onClick={() => {
          const next = page + 1; setPage(next); writeProductTableUrl({ page: String(next) })
        }}>Sonraki</Button>
      </div>
      <Dialog open={selected !== null} onOpenChange={(nextOpen) => { if (!nextOpen) closeDetail() }}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.name}</DialogTitle>
              <DialogDescription>Seçili dönemdeki ürün performansı</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-2">
              {[
                ['Adet', String(selected.count)],
                ['Tutar', formatCurrency(selected.revenue)],
                ['Tahsilat payı', `%${selected.sharePct.toLocaleString('tr-TR')}`],
                ['ABC sınıfı', selected.abcClass],
                ['Önceki dönem değişimi', formatProductDelta(selected.deltaPct)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDetail}>Kapat</Button></DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function RisersList({ items }: { items: ProductReportItem[] }) {
  if (items.length === 0) {
    return <Empty className="min-h-28"><EmptyHeader><EmptyTitle>Yükselen ürün yok</EmptyTitle><EmptyDescription>Bu dönemde anlamlı artış gösteren ürün bulunamadı.</EmptyDescription></EmptyHeader></Empty>
  }

  return (
    <ItemGroup className="p-2">
      {items.map((item, index) => (
        <Item key={item.name} size="sm">
          <ItemMedia style={s.mono} className="text-xs text-muted-foreground">{index + 1}</ItemMedia>
          <ItemContent><ItemTitle>{item.name}</ItemTitle><ItemDescription>{formatCurrency(item.revenue)} · {item.count} adet</ItemDescription></ItemContent>
          <ItemActions><Badge variant="positive">↑ {formatProductDelta(item.deltaPct)}</Badge></ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

function FallersList({ items }: { items: ProductReportItem[] }) {
  if (items.length === 0) {
    return <Empty className="min-h-28"><EmptyHeader><EmptyTitle>Düşen ürün yok</EmptyTitle><EmptyDescription>Bu dönemde anlamlı düşüş gösteren ürün bulunamadı.</EmptyDescription></EmptyHeader></Empty>
  }

  return (
    <ItemGroup className="p-2">
      {items.map((item, index) => (
        <Item key={item.name} size="sm">
          <ItemMedia style={s.mono} className="text-xs text-muted-foreground">{index + 1}</ItemMedia>
          <ItemContent><ItemTitle>{item.name}</ItemTitle><ItemDescription>{formatCurrency(item.revenue)} · {item.count} adet</ItemDescription></ItemContent>
          <ItemActions><Badge variant="destructive">↓ {formatProductDelta(item.deltaPct)}</Badge></ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
