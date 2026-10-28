'use client'

import { useState } from 'react'
import type { PanoBusinessSource, PanoStaffSource } from '@garsonless/application/read-models'
import type { HeatmapCell, TopItem } from '../../lib/queries/pano'
import { formatPanoCurrency } from '../../lib/pano-format'
import { I } from '../../lib/ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PanoCard, PanoCardSkeleton, PanoPeakHours, PanoReportsLink } from './PanoOverviewWidgets'
import { buildPanoBusinessView, buildPanoCalmView, foodCostSummary, type PanoBusinessBar, type PanoBusinessPeriod } from './pano-business-model'
import { usePanoBusiness } from './use-pano-business'
import { PanoShiftStaff } from './PanoShiftStaff'

const PERIODS: Array<{ value: PanoBusinessPeriod; label: string }> = [
  { value: 'today', label: 'Bugün' },
  { value: 7, label: '7 gün' },
  { value: 30, label: '30 gün' },
]

const TONE_CLASS = { up: 'text-[var(--positive)]', down: 'text-destructive', flat: 'text-muted-foreground', neutral: 'text-muted-foreground' } as const

/** The owner's first screen: takings against comparable days, products and peak hours. */
export function PanoBusinessView({
  restaurantId,
  business,
  topItems,
  heatmap,
  context,
  attention,
  canInventory,
  staff,
  timezone,
}: {
  restaurantId: string
  business: PanoBusinessSource | null
  topItems: TopItem[]
  heatmap: HeatmapCell[]
  context: { weekday: string; currentHour: number; openAmount: number; openTables: number }
  /** Work waiting right now, with a way to the shift view when the viewer has one. */
  attention: { count: number; text: string; onOpen: (() => void) | null }
  canInventory: boolean
  staff: PanoStaffSource | null
  timezone: string
}) {
  const { period, setPeriod, source, loading, error } = usePanoBusiness(restaurantId, business)
  const [productTab, setProductTab] = useState<'top' | 'low'>('top')
  const view = source ? buildPanoBusinessView(source, period, context) : null
  const food = source ? foodCostSummary(source.foodCost) : null
  const calm = source && period === 'today' ? buildPanoCalmView(source, context.weekday) : null

  return (
    <section aria-label="İşletme özeti" className="flex flex-col gap-4">
      {attention.count > 0 && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <I.warn />
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2 text-foreground">
            <span className="min-w-0 flex-[1_1_260px]"><strong>{attention.count} iş şimdi bekliyor</strong> · {attention.text}</span>
            {attention.onOpen && <Button size="sm" variant="outline" onClick={attention.onOpen}>Vardiya görünümünde aç</Button>}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">İşletme özeti</h2>
        <ToggleGroup
          variant="outline"
          size="sm"
          aria-label="Dönem"
          value={[String(period)]}
          onValueChange={(values) => {
            const next = PERIODS.find((option) => String(option.value) === values[0])
            if (next) setPeriod(next.value)
          }}
        >
          {PERIODS.map((option) => <ToggleGroupItem key={option.label} value={String(option.value)} className="aria-pressed:bg-foreground aria-pressed:text-background">{option.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {!view ? (
        loading ? <PanoCardSkeleton label="İşletme özeti yükleniyor" /> : <Alert><AlertDescription>İşletme özeti şu an alınamadı. Sayfayı yenileyin.</AlertDescription></Alert>
      ) : (
        <>
          {calm ? (
            <section aria-labelledby="pano-calm-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div>
                <h3 id="pano-calm-heading" className="text-lg font-semibold">Bugün henüz satış yok</h3>
                <p className="m-0 text-sm text-muted-foreground">İlk tahsilatla birlikte ciro ve karşılaştırmalar burada başlar.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {calm.tiles.map((tile) => (
                  <div key={tile.label} className="flex flex-col gap-1 rounded-lg border p-3">
                    <span className="text-xs text-muted-foreground">{tile.label}</span>
                    <strong className="pano-number text-xl font-semibold">{tile.value}</strong>
                    <span className="text-xs text-muted-foreground">{tile.sub}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <section aria-label={view.revenueLabel} className="col-span-2 flex flex-col gap-3 rounded-xl bg-foreground p-4 text-background lg:col-span-1" aria-busy={loading}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-xs font-medium opacity-80">{view.revenueLabel}</h3>
                <span className="flex-1" />
                {loading && <Spinner aria-hidden="true" />}
                {view.goal && <span className="text-xs opacity-80">{view.goal.text}</span>}
              </div>
              <strong className="pano-number text-4xl font-semibold leading-none tracking-tight">{view.revenue}</strong>
              {view.goal && <Progress value={view.goal.percent} aria-label={`Hedefin yüzde ${view.goal.percent} kadarı`} className="[&_[data-slot=progress-indicator]]:bg-[var(--positive-bg)] [&_[data-slot=progress-track]]:bg-background/20" />}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                {view.comparisons.map((comparison) => (
                  <span key={comparison.label} className="inline-flex items-center gap-1.5 opacity-90">
                    {comparison.label} <strong className="pano-number">{comparison.value}</strong>
                    <Badge variant={comparison.tone === 'up' ? 'positive' : comparison.tone === 'down' ? 'destructive' : 'secondary'}>{comparison.delta}</Badge>
                  </span>
                ))}
              </div>
            </section>
            {view.tiles.map((tile) => (
              <section key={tile.label} aria-label={tile.label} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
                <h3 className="text-xs font-medium text-muted-foreground">{tile.label}</h3>
                <strong className="pano-number text-2xl font-semibold tracking-tight">{tile.value}</strong>
                <span className={`text-xs ${TONE_CLASS[tile.tone]}`}>{tile.sub}</span>
              </section>
            ))}
          </div>
          )}

          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <PanoCard title={view.chart.title} subtitle={view.chart.note}>
              <ComparisonChart bars={view.chart.bars} currentLabel={view.chart.currentLabel} previousLabel={view.chart.previousLabel} />
            </PanoCard>
            <PanoCard
              title="Ürünler"
              subtitle={productTab === 'top' ? 'Bugün tahsil edilen siparişlerden' : 'Son 30 günde en az satanlar'}
              action={(
                <ToggleGroup variant="outline" size="sm" aria-label="Ürün listesi" value={[productTab]} onValueChange={(values) => { if (values[0] === 'top' || values[0] === 'low') setProductTab(values[0]) }}>
                  <ToggleGroupItem value="top" className="aria-pressed:bg-foreground aria-pressed:text-background">Çok satan</ToggleGroupItem>
                  <ToggleGroupItem value="low" className="aria-pressed:bg-foreground aria-pressed:text-background">Az satan</ToggleGroupItem>
                </ToggleGroup>
              )}
            >
              <ProductList rows={productTab === 'top' ? topItems.map((item) => ({ name: item.name, count: item.count, revenue: item.revenue })) : (source?.lowItems ?? []).map((item) => ({ ...item, revenue: null }))} low={productTab === 'low'} />
            </PanoCard>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <PanoPeakHours heatmap={heatmap} />
            <div className="flex flex-col gap-3">
              <PanoShiftStaff
                staff={staff ?? []}
                timezone={timezone}
                footer={(
                  <p className="m-0 flex flex-wrap gap-x-4 border-t pt-2 text-xs text-muted-foreground">
                    <span>İkram <strong className="pano-number text-foreground">{formatPanoCurrency(source?.today.comp ?? 0)}</strong></span>
                    <span>İptal <strong className="pano-number text-foreground">{source?.today.cancelledCount ?? 0} · {formatPanoCurrency(source?.today.cancelledTotal ?? 0)}</strong></span>
                  </p>
                )}
              />
              <PanoCard title="Gıda maliyeti ve brüt kâr" subtitle="Son 7 gün">
                <div className="flex flex-col gap-2 p-4 text-sm">
                  {food ? (
                    <>
                      <span><strong className="pano-number text-lg">%{food.percent}</strong> gıda maliyeti · brüt kâr yaklaşık <strong className="pano-number">{formatPanoCurrency(food.grossProfit)}</strong></span>
                      <span className="text-xs text-muted-foreground">Satışların stoktan düşen maliyeti, tahsil edilen ciroya göre.{food.partial ? ' Bazı stokların fiyatı girilmemiş; oran eksik olabilir.' : ''}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Stok takibinde reçete ve alış fiyatı girildiğinde gıda maliyeti ve brüt kâr burada görünür.</span>
                  )}
                  {canInventory && <Button variant="link" size="sm" className="h-auto self-start px-0" nativeButton={false} render={<a href={`/dashboard/${restaurantId}/inventory`} />}>Stok ve maliyetler</Button>}
                </div>
              </PanoCard>
            </div>
          </div>
          <PanoReportsLink href={`/dashboard/${restaurantId}/analytics`} />
        </>
      )}
    </section>
  )
}

function ComparisonChart({ bars, currentLabel, previousLabel }: { bars: PanoBusinessBar[]; currentLabel: string; previousLabel: string }) {
  const max = Math.max(1, ...bars.flatMap((bar) => [bar.current ?? 0, bar.previous]))
  const summary = bars.map((bar) => `${bar.label}: ${bar.current === null ? 'henüz yok' : formatPanoCurrency(bar.current)}, karşılaştırma ${formatPanoCurrency(bar.previous)}`).join('; ')
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="size-2.5 rounded-sm bg-foreground" />{currentLabel}</span>
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="size-2.5 rounded-sm bg-muted-foreground/40" />{previousLabel}</span>
      </div>
      <div role="img" aria-label={`${currentLabel} ve ${previousLabel}. ${summary}`} className="flex h-48 items-end gap-1 border-b">
        {bars.map((bar) => (
          <div key={bar.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
            <div
              className={`w-[42%] rounded-t-sm ${bar.current === null ? 'border border-dashed border-muted-foreground/40' : 'bg-foreground'}`}
              style={{ height: bar.current === null ? 6 : `${(bar.current / max) * 100}%` }}
            />
            <div className="w-[42%] rounded-t-sm bg-muted-foreground/40" style={{ height: `${(bar.previous / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-1">
        {bars.map((bar) => <span key={bar.label} className="pano-number min-w-0 flex-1 truncate text-center text-[10.5px] text-muted-foreground">{bar.label}</span>)}
      </div>
    </div>
  )
}

function ProductList({ rows, low }: { rows: Array<{ name: string; count: number; revenue: number | null }>; low: boolean }) {
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">{low ? 'Son 30 günde satış yok.' : 'Bugün henüz tahsil edilen satış yok.'}</p>
  const max = Math.max(1, ...rows.map((row) => row.revenue ?? row.count))
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-4">
      {rows.slice(0, 5).map((row) => (
        <li key={row.name} className="flex flex-col gap-1">
          <span className="flex gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
            <span className="text-muted-foreground">{row.count.toLocaleString('tr-TR')} adet</span>
            {row.revenue !== null && <strong className="pano-number min-w-16 text-right">{formatPanoCurrency(row.revenue)}</strong>}
          </span>
          <Progress value={((row.revenue ?? row.count) / max) * 100} aria-hidden="true" />
        </li>
      ))}
    </ul>
  )
}
