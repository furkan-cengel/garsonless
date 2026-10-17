'use client'

import { Fragment, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { I } from '../../lib/ui'
import { formatPanoCurrency, formatPanoInteger } from '../../lib/pano-format'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { HeatmapCell, PanoAttentionItem, TopItem } from '../../lib/queries/pano'
import type { PanoHealthCheck, PanoHealthStatus, PanoKpiCardModel } from './pano-view-model'
import { selectVisiblePanoAttentionItems } from '../../lib/pano-attention-model'

export function PanoCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card size="sm" className="h-full gap-0 py-0">
      <CardHeader className="min-h-14 border-b py-3">
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="flex-1 p-0">{children}</CardContent>
    </Card>
  )
}

export function PanoCardSkeleton({ label }: { label: string }) {
  return (
    <Card size="sm" role="status" aria-live="polite" aria-busy="true" className="h-full gap-0 py-0">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="contents">
        <CardHeader className="min-h-14 border-b py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="min-h-56 w-full flex-1" />
        </CardContent>
      </div>
    </Card>
  )
}

export function PanoEmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <Empty className="pano-empty min-h-40">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {sub && <EmptyDescription>{sub}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}

export function PanoSetupNotice({ items }: { items: PanoAttentionItem[] }) {
  return items.map((item) => (
    <Alert key={item.id} role="note" className="mb-4">
      <I.card aria-hidden="true" />
      <AlertTitle>Kurulum · {item.title}</AlertTitle>
      <AlertDescription>
        {item.detail}{' '}
        {item.actionHref && <Link href={item.actionHref}>Ödeme ayarlarına git</Link>}
      </AlertDescription>
    </Alert>
  ))
}

export function PanoKpiCard({ model }: { model: PanoKpiCardModel }) {
  const indicatorTone = model.indicatorTone ?? (model.trend === 'down' ? 'critical' : model.trend === 'flat' ? 'neutral' : 'positive')
  const indicatorVariant = {
    positive: 'positive',
    warning: 'warning',
    critical: 'destructive',
    neutral: 'secondary',
  }[indicatorTone] as 'positive' | 'warning' | 'destructive' | 'secondary'

  const content = (
    <Card
      className={cn(
        'pano-kpi-card h-full min-h-[126px] gap-0 py-4 [--card-spacing:16px] transition-[transform,box-shadow]',
        model.featured && 'bg-primary text-primary-foreground ring-transparent',
      )}
    >
      <CardHeader className="gap-0">
        <div className="pano-kpi-meta mb-2 flex flex-wrap items-center justify-between gap-2">
          <CardDescription className={cn('text-[11.5px] leading-none font-medium tracking-[0.05em] uppercase', model.featured && 'text-primary-foreground/60')}>
            {model.label}
          </CardDescription>
          <Badge variant={indicatorVariant} className="pano-number h-auto px-[7px] py-[3px] text-[10.5px] leading-none font-semibold">
            {model.trend === 'up' ? '↑' : model.trend === 'down' ? '↓' : ''}
            {model.delta}
          </Badge>
        </div>
        <CardTitle className={cn('pano-metric-value text-[24px] leading-none font-bold', model.featured && 'text-[var(--accent-2)]')}>
          {model.value}
        </CardTitle>
        <CardDescription className={cn('pano-number mt-1.5 text-[11px] leading-normal', model.featured && 'text-primary-foreground/60')}>{model.sub}</CardDescription>
      </CardHeader>
    </Card>
  )

  return model.href ? (
    <Link href={model.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} className="pano-kpi-link">
      {content}
    </Link>
  ) : (
    content
  )
}

const ATTENTION_VARIANTS = {
  critical: 'destructive',
  warning: 'warning',
  info: 'info',
} satisfies Record<PanoAttentionItem['severity'], 'destructive' | 'warning' | 'info'>

const ATTENTION_DOTS: Record<PanoAttentionItem['severity'], string> = {
  critical: 'var(--critical)',
  warning: 'var(--warning)',
  info: 'var(--info)',
}

export function PanoAttentionQueue({ items }: { items: PanoAttentionItem[] }) {
  const visibleItems = selectVisiblePanoAttentionItems(items)
  return (
    <section aria-labelledby="pano-attention-title">
      <PanoCard
        title="Siparişler ve bağlantı"
        subtitle={items.length > 0 ? `${items.length} sinyal işlem bekliyor` : 'Bekleyen sipariş yok'}
        action={
          items.length > visibleItems.length ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>İlk {visibleItems.length} gösteriliyor</span> : undefined
        }
      >
        <h2 id="pano-attention-title" className="sr-only">
          Siparişler ve bağlantı
        </h2>
        {visibleItems.length === 0 ? (
          <div role="status">
            <PanoEmptyState title="Bekleyen sipariş yok" sub="Onay bekleyen siparişler ve bağlantı sorunları burada görünür" />
          </div>
        ) : (
          <ItemGroup aria-live="polite" className="gap-0">
            {visibleItems.map((item, index) => {
              return (
                <Fragment key={item.id}>
                  <Item role="listitem" size="sm" className="min-h-[58px] rounded-none">
                    <ItemMedia variant="icon">
                      <Badge variant={ATTENTION_VARIANTS[item.severity]} className="size-8 p-0" aria-hidden="true">
                        <span className="size-2 rounded-full" style={{ background: ATTENTION_DOTS[item.severity] }} />
                      </Badge>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{item.title}</ItemTitle>
                      <ItemDescription className="pano-number line-clamp-1">{item.detail}</ItemDescription>
                    </ItemContent>
                    {item.actionHref && (
                      <ItemActions>
                        <Link
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                          href={item.actionHref}
                          aria-label={`${item.title}: incele`}
                        >
                          İncele <I.chevRight data-icon="inline-end" />
                        </Link>
                      </ItemActions>
                    )}
                  </Item>
                  {index < visibleItems.length - 1 && <ItemSeparator className="my-0" />}
                </Fragment>
              )
            })}
          </ItemGroup>
        )}
      </PanoCard>
    </section>
  )
}

export function PanoTopItemsWidget({ items }: { items: TopItem[] }) {
  const maxCount = items[0]?.count ?? 1
  return (
    <PanoCard title="Bugünün yıldızları" subtitle="Tahsil edilmiş siparişlerden">
      {items.length === 0 ? (
        <PanoEmptyState title="Henüz satış yok" sub="Siparişlerden sonra ürünler burada görünür" />
      ) : (
        <ItemGroup className="gap-2 p-3">
          {items.map((item, index) => {
            const width = (item.count / maxCount) * 100
            return (
              <Item key={item.name} size="xs">
                <ItemMedia>
                  <Badge variant={index === 0 ? 'warning' : 'secondary'}>{index + 1}</Badge>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="w-full justify-between">
                    <span className="truncate">{item.name}</span>
                    <span className="pano-number">×{formatPanoInteger(item.count)}</span>
                  </ItemTitle>
                  <ItemDescription className="pano-number">{formatPanoCurrency(item.revenue)}</ItemDescription>
                  <Progress value={width} aria-label={`${item.name}: en yüksek adedin yüzde ${Math.round(width)} kadarı`} />
                </ItemContent>
              </Item>
            )
          })}
        </ItemGroup>
      )}
    </PanoCard>
  )
}

const HEATMAP_HOURS = Array.from({ length: 15 }, (_, index) => index + 8)

export function PanoPeakHours({ heatmap }: { heatmap: HeatmapCell[] }) {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  const [view, setView] = useState<'heatmap' | 'table'>('heatmap')
  const [tooltip, setTooltip] = useState<{
    key: string
    day: string
    hour: number
    count: number
    x: number
    y: number
  } | null>(null)
  const grid: Record<string, number> = {}
  let maximum = 0
  let peakDay = 0
  let peakHour = HEATMAP_HOURS[0] ?? 8
  for (const cell of heatmap) {
    grid[`${cell.day}-${cell.hour}`] = cell.count
    if (cell.count > maximum) {
      maximum = cell.count
      peakDay = cell.day
      peakHour = cell.hour
    }
  }

  const showTooltip = (target: HTMLElement, key: string, day: string, hour: number, count: number) => {
    if (count === 0) return
    const bounds = target.getBoundingClientRect()
    const viewportWidth = target.ownerDocument.defaultView?.innerWidth ?? 320
    setTooltip({
      key,
      day,
      hour,
      count,
      x: Math.max(88, Math.min(bounds.left + bounds.width / 2, viewportWidth - 88)),
      y: bounds.top - 8,
    })
  }

  const showMouseTooltip = (event: MouseEvent<HTMLSpanElement>, key: string, day: string, hour: number, count: number) => {
    showTooltip(event.currentTarget, key, day, hour, count)
  }

  const showFocusTooltip = (event: FocusEvent<HTMLSpanElement>, key: string, day: string, hour: number, count: number) => {
    showTooltip(event.currentTarget, key, day, hour, count)
  }

  const selectView = (nextView: 'heatmap' | 'table') => {
    setTooltip(null)
    setView(nextView)
  }

  return (
    <PanoCard
      title="Yoğun saatler"
      subtitle="Son 30 gün · sipariş yoğunluğu"
      action={
        maximum > 0 ? (
          <ToggleGroup
            value={[view]}
            onValueChange={(values) => {
              const nextView = values[0] as 'heatmap' | 'table' | undefined
              if (nextView) selectView(nextView)
            }}
            size="sm"
            spacing={0}
            aria-label="Yoğun saat görünümü"
          >
            <ToggleGroupItem value="heatmap">Isı haritası</ToggleGroupItem>
            <ToggleGroupItem value="table">Tablo</ToggleGroupItem>
          </ToggleGroup>
        ) : undefined
      }
    >
      {maximum === 0 ? (
        <PanoEmptyState title="Yeterli veri yok" sub="Siparişler biriktikçe yoğun saatler burada görünür" />
      ) : (
        <div style={{ padding: 14 }}>
          <p
            role="status"
            style={{
              margin: '0 0 10px',
              fontSize: 11.5,
              color: 'var(--text-2)',
            }}
          >
            En yoğun zaman:{' '}
            <strong>
              {days[peakDay]} {String(peakHour).padStart(2, '0')}:00
            </strong>{' '}
            · {maximum} sipariş
          </p>
          {view === 'heatmap' ? (
            <div
              className="pano-peak-view"
              role="group"
              aria-label={`Isı haritası. En yoğun zaman ${days[peakDay]} ${String(peakHour).padStart(2, '0')}:00, ${maximum} sipariş. Ayrıntılı değerler için Tablo görünümünü seçin.`}
            >
              <div className="pano-heatmap-scroll">
                <div
                  style={{
                    minWidth: 300,
                    display: 'grid',
                    gridTemplateColumns: `auto repeat(${HEATMAP_HOURS.length}, 1fr)`,
                    gap: 1.5,
                    alignItems: 'center',
                  }}
                >
                  <span />
                  {HEATMAP_HOURS.map((hour) => (
                    <span
                      key={hour}
                      className="pano-number pano-heatmap-axis"
                      style={{
                        textAlign: 'center',
                      }}
                    >
                      {hour % 3 === 0 ? hour : ''}
                    </span>
                  ))}
                  {days.map((day, dayIndex) => (
                    <Fragment key={day}>
                      <span className="pano-heatmap-axis" style={{ paddingRight: 5, fontWeight: 600 }}>
                        {day}
                      </span>
                      {HEATMAP_HOURS.map((hour) => {
                        const count = grid[`${dayIndex}-${hour}`] ?? 0
                        const intensity = count / maximum
                        const key = `${day}-${hour}`
                        const label = `${day} ${String(hour).padStart(2, '0')}:00 · ${count} sipariş`
                        return (
                          <span
                            key={key}
                            className="pano-heatmap-cell"
                            role={count > 0 ? 'img' : undefined}
                            tabIndex={count > 0 ? 0 : -1}
                            aria-label={count > 0 ? label : undefined}
                            aria-hidden={count === 0 ? 'true' : undefined}
                            onMouseEnter={(event) => showMouseTooltip(event, key, day, hour, count)}
                            onMouseLeave={() => setTooltip((current) => (current?.key === key ? null : current))}
                            onFocus={(event) => showFocusTooltip(event, key, day, hour, count)}
                            onBlur={() => setTooltip((current) => (current?.key === key ? null : current))}
                            style={{
                              aspectRatio: '1',
                              borderRadius: 1.5,
                              background: count === 0 ? 'var(--surface-3)' : `rgba(47, 111, 78, ${0.18 + intensity * 0.82})`,
                              cursor: count > 0 ? 'help' : 'default',
                            }}
                          />
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  fontSize: 11,
                  color: 'var(--text-3)',
                }}
              >
                <span>Az</span>
                <div
                  style={{
                    display: 'flex',
                    gap: 2,
                    flex: 1,
                    margin: '0 8px',
                    maxWidth: 100,
                  }}
                >
                  {[0.2, 0.4, 0.6, 0.8, 1].map((opacity) => (
                    <div
                      key={opacity}
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 1,
                        background: `rgba(47, 111, 78, ${opacity})`,
                      }}
                    />
                  ))}
                </div>
                <span>Çok</span>
              </div>
            </div>
          ) : (
            <div className="pano-peak-view" aria-label="Tablo görünümü">
              <Table>
                <TableCaption className="sr-only">Son 30 günün gün ve saat bazında sipariş yoğunluğu</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Gün</TableHead>
                    {HEATMAP_HOURS.map((hour) => (
                      <TableHead scope="col" key={hour}>
                        {String(hour).padStart(2, '0')}:00
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((day, dayIndex) => (
                    <TableRow key={day}>
                      <TableHead scope="row">{day}</TableHead>
                      {HEATMAP_HOURS.map((hour) => (
                        <TableCell className="pano-number" key={hour}>{formatPanoInteger(grid[`${dayIndex}-${hour}`] ?? 0)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {tooltip && (
            <div role="tooltip" className="pano-heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
              <strong>
                {tooltip.day} {String(tooltip.hour).padStart(2, '0')}:00
              </strong>
              <span>{tooltip.count} sipariş</span>
            </div>
          )}
        </div>
      )}
    </PanoCard>
  )
}

const HEALTH_BADGES = {
  ok: { variant: 'positive', label: 'Aktif' },
  warn: { variant: 'warning', label: 'Dikkat' },
  down: { variant: 'destructive', label: 'Yok' },
  idle: { variant: 'secondary', label: '-' },
} satisfies Record<
  PanoHealthStatus,
  {
    variant: 'positive' | 'warning' | 'destructive' | 'secondary'
    label: string
  }
>

export function PanoSystemHealth({ checks, onRetry, retrying }: { checks: PanoHealthCheck[]; onRetry: () => void; retrying: boolean }) {
  return (
    <PanoCard
      title="Canlı bağlantı"
      subtitle="Senkronizasyon ve sistem sinyalleri"
      action={
        <Button variant="ghost" size="sm" onClick={onRetry} disabled={retrying} aria-busy={retrying} aria-label="Pano canlı verilerini yeniden dene">
          {retrying ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <I.refresh data-icon="inline-start" />}
          {retrying ? 'Yenileniyor' : 'Yenile'}
        </Button>
      }
    >
      <ItemGroup role="status" aria-live="polite" className="gap-0 py-1">
        {checks.map((check, index) => {
          const status = HEALTH_BADGES[check.status]
          return (
            <Fragment key={check.label}>
              <Item role="listitem" size="sm" className="rounded-none">
                <ItemContent>
                  <ItemTitle>{check.label}</ItemTitle>
              <ItemDescription className="pano-number">{check.detail}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </ItemActions>
              </Item>
              {index < checks.length - 1 && <ItemSeparator className="my-0" />}
            </Fragment>
          )
        })}
      </ItemGroup>
    </PanoCard>
  )
}

/** Pano is the quick look; filters, comparisons and exports live in Raporlar. */
export function PanoReportsLink({ href }: { href: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
      <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={href}>
        Raporlarda ayrıntı <I.chevRight data-icon="inline-end" />
      </Link>
    </div>
  )
}
