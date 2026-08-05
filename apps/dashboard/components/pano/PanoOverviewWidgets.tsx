'use client'

import { Fragment, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { EmptyState, I, S } from '../../lib/ui'
import type { HeatmapCell, PanoAttentionItem, TopItem } from '../../lib/queries/pano'
import type {
  PanoHealthCheck,
  PanoHealthStatus,
  PanoKpiCardModel,
} from './pano-view-model'

export function PanoCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
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

export function PanoKpiCard({ model }: { model: PanoKpiCardModel }) {
  const indicatorTone = model.indicatorTone ?? (model.trend === 'down' ? 'critical' : 'positive')
  const indicatorColors = {
    positive: { background: 'var(--positive-bg)', foreground: 'var(--positive)' },
    warning: { background: 'var(--warning-bg)', foreground: 'var(--warning)' },
    critical: { background: 'var(--critical-bg)', foreground: 'var(--critical)' },
    neutral: { background: 'var(--surface-3)', foreground: 'var(--text-3)' },
  }[indicatorTone]
  const featuredIndicator = model.trend === 'down'
    ? { background: 'rgba(255, 120, 112, .16)', foreground: '#ff9b94' }
    : { background: 'rgba(94, 232, 164, .15)', foreground: '#5ee8a4' }

  const content = (
    <div style={{
      background: model.featured ? 'linear-gradient(135deg, #18181b 0%, #2a2a30 100%)' : 'var(--surface)',
      color: model.featured ? '#fff' : 'var(--text)',
      borderRadius: 12, border: `1px solid ${model.featured ? 'transparent' : 'var(--border)'}`,
      padding: 16, position: 'relative', overflow: 'hidden', minHeight: 126,
      transition: 'background 120ms, border-color 120ms, transform 120ms, box-shadow 120ms',
    }}>
      {model.featured && (
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 120, height: 120,
          background: 'radial-gradient(circle, rgba(255,208,137,.15) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 11.5, fontWeight: 500,
          color: model.featured ? 'rgba(255,255,255,.55)' : 'var(--text-3)',
          letterSpacing: '.05em', textTransform: 'uppercase',
        }}>{model.label}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 7px', borderRadius: 999,
          background: model.featured ? featuredIndicator.background : indicatorColors.background,
          color: model.featured ? featuredIndicator.foreground : indicatorColors.foreground,
          fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
        }}>{model.trend === 'up' ? '↑' : model.trend === 'down' ? '↓' : ''}{model.delta}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1,
        ...S.mono, color: model.featured ? '#ffd089' : 'var(--text)',
      }}>{model.value}</div>
      <div style={{ fontSize: 11, color: model.featured ? 'rgba(255,255,255,.55)' : 'var(--text-3)', marginTop: 6 }}>{model.sub}</div>
    </div>
  )

  return model.href ? (
    <Link
      href={model.href}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      className="pano-kpi-link"
    >
      {content}
    </Link>
  ) : content
}

const ATTENTION_COLORS: Record<PanoAttentionItem['severity'], { dot: string; background: string }> = {
  critical: { dot: 'var(--critical)', background: 'var(--critical-bg)' },
  warning: { dot: 'var(--warning)', background: 'var(--warning-bg)' },
  info: { dot: 'var(--info)', background: 'var(--info-bg)' },
}

export function PanoAttentionQueue({ items }: { items: PanoAttentionItem[] }) {
  const visibleItems = items.slice(0, 6)
  return (
    <section id="pano-attention" aria-labelledby="pano-attention-title">
      <PanoCard
        title="Dikkat gerekenler"
        subtitle={items.length > 0 ? `${items.length} açık operasyon sinyali` : 'Operasyon kuyruğu temiz'}
        action={items.length > visibleItems.length ? (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>İlk {visibleItems.length} gösteriliyor</span>
        ) : undefined}
      >
        <h2 id="pano-attention-title" className="sr-only">Dikkat gerekenler</h2>
        {visibleItems.length === 0 ? (
          <div role="status">
            <EmptyState title="Acil işlem yok" sub="Yeni sipariş, servis çağrısı ve geciken masalar burada görünür" />
          </div>
        ) : (
          <ul aria-live="polite" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visibleItems.map((item, index) => {
              const colors = ATTENTION_COLORS[item.severity]
              return (
                <li key={item.id} style={{
                  minHeight: 58, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 11,
                  borderBottom: index === visibleItems.length - 1 ? 'none' : '1px solid var(--divider)',
                }}>
                  <span aria-hidden="true" style={{
                    width: 32, height: 32, flexShrink: 0, borderRadius: 9,
                    background: colors.background, display: 'grid', placeItems: 'center',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: colors.dot }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)' }}>{item.title}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div>
                  </div>
                  {item.actionHref && (
                    <Link className="pano-attention-action" href={item.actionHref} aria-label={`${item.title}: incele`}>
                      İncele <I.chevRight size={13} />
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </PanoCard>
    </section>
  )
}

export function PanoTopItemsWidget({ items }: { items: TopItem[] }) {
  const maxCount = items[0]?.count ?? 1
  return (
    <PanoCard title="Bugünün yıldızları" subtitle="Tahsil edilmiş siparişlerden">
      {items.length === 0
        ? <EmptyState title="Henüz satış yok" sub="Siparişlerden sonra ürünler burada görünür" />
        : (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, index) => {
              const width = (item.count / maxCount) * 100
              return (
                <div key={item.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-4)', width: 16, textAlign: 'right', flexShrink: 0 }}>{index + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ ...S.mono, fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>×{item.count}</span>
                    <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>₺{item.revenue.toLocaleString('tr-TR')}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', marginLeft: 24 }}>
                    <div style={{ height: '100%', width: `${width}%`, background: index === 0 ? '#ffd089' : 'var(--text)', transition: 'width 240ms' }} />
                  </div>
                </div>
              )
            })}
          </div>
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

  const showTooltip = (
    target: HTMLElement,
    key: string,
    day: string,
    hour: number,
    count: number,
  ) => {
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
      action={maximum > 0 ? (
        <div className="pano-peak-view-switch" role="group" aria-label="Yoğun saat görünümü">
          <button type="button" aria-pressed={view === 'heatmap'} onClick={() => selectView('heatmap')}>Isı haritası</button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => selectView('table')}>Tablo</button>
        </div>
      ) : undefined}
    >
      {maximum === 0 ? (
        <EmptyState title="Yeterli veri yok" sub="Siparişler biriktikçe yoğun saatler burada görünür" />
      ) : (
        <div style={{ padding: 14 }}>
          <p role="status" style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--text-2)' }}>
            En yoğun zaman: <strong>{days[peakDay]} {String(peakHour).padStart(2, '0')}:00</strong> · {maximum} sipariş
          </p>
          {view === 'heatmap' ? (
            <div className="pano-peak-view" aria-label="Isı haritası görünümü">
              <div className="pano-heatmap-scroll">
                <div style={{ minWidth: 300, display: 'grid', gridTemplateColumns: `auto repeat(${HEATMAP_HOURS.length}, 1fr)`, gap: 1.5, alignItems: 'center' }}>
                  <span />
                  {HEATMAP_HOURS.map((hour) => (
                    <span key={hour} style={{ fontSize: 8, color: 'var(--text-4)', textAlign: 'center', ...S.mono }}>
                      {hour % 3 === 0 ? hour : ''}
                    </span>
                  ))}
                  {days.map((day, dayIndex) => (
                    <Fragment key={day}>
                      <span style={{ fontSize: 9.5, color: 'var(--text-3)', paddingRight: 5, fontWeight: 500 }}>{day}</span>
                      {HEATMAP_HOURS.map((hour) => {
                        const count = grid[`${dayIndex}-${hour}`] ?? 0
                        const intensity = count / maximum
                        const key = `${day}-${hour}`
                        const label = `${day} ${String(hour).padStart(2, '0')}:00 · ${count} sipariş`
                        return (
                          <span
                            key={key}
                            className="pano-heatmap-cell"
                            role="img"
                            tabIndex={count > 0 ? 0 : -1}
                            aria-label={label}
                            onMouseEnter={(event) => showMouseTooltip(event, key, day, hour, count)}
                            onMouseLeave={() => setTooltip((current) => current?.key === key ? null : current)}
                            onFocus={(event) => showFocusTooltip(event, key, day, hour, count)}
                            onBlur={() => setTooltip((current) => current?.key === key ? null : current)}
                            style={{
                              aspectRatio: '1', borderRadius: 1.5,
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-3)' }}>
                <span>Az</span>
                <div style={{ display: 'flex', gap: 2, flex: 1, margin: '0 8px', maxWidth: 100 }}>
                  {[0.2, 0.4, 0.6, 0.8, 1].map((opacity) => (
                    <div key={opacity} style={{ flex: 1, height: 8, borderRadius: 1, background: `rgba(47, 111, 78, ${opacity})` }} />
                  ))}
                </div>
                <span>Çok</span>
              </div>
            </div>
          ) : (
            <div className="pano-peak-view pano-data-table-scroll" aria-label="Tablo görünümü">
              <table className="pano-data-table">
                <caption className="sr-only">Son 30 günün gün ve saat bazında sipariş yoğunluğu</caption>
                <thead>
                  <tr><th scope="col">Gün</th>{HEATMAP_HOURS.map((hour) => <th scope="col" key={hour}>{String(hour).padStart(2, '0')}:00</th>)}</tr>
                </thead>
                <tbody>
                  {days.map((day, dayIndex) => (
                    <tr key={day}>
                      <th scope="row">{day}</th>
                      {HEATMAP_HOURS.map((hour) => <td key={hour}>{grid[`${dayIndex}-${hour}`] ?? 0}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tooltip && (
            <div
              role="tooltip"
              className="pano-heatmap-tooltip"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <strong>{tooltip.day} {String(tooltip.hour).padStart(2, '0')}:00</strong>
              <span>{tooltip.count} sipariş</span>
            </div>
          )}
        </div>
      )}
    </PanoCard>
  )
}

const HEALTH_COLORS: Record<PanoHealthStatus, { dot: string; foreground: string; label: string }> = {
  ok: { dot: 'var(--positive)', foreground: 'var(--positive)', label: 'Aktif' },
  warn: { dot: 'var(--warning)', foreground: 'var(--warning)', label: 'Dikkat' },
  down: { dot: 'var(--critical)', foreground: 'var(--critical)', label: 'Yok' },
  idle: { dot: 'var(--text-4)', foreground: 'var(--text-3)', label: '—' },
}

export function PanoSystemHealth({
  checks,
  onRetry,
  retrying,
}: {
  checks: PanoHealthCheck[]
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <PanoCard
      title="Canlı bağlantı"
      subtitle="Senkronizasyon ve sistem sinyalleri"
      action={(
        <button
          type="button"
          className="pano-live-retry"
          onClick={onRetry}
          disabled={retrying}
          aria-label="Pano canlı verilerini yeniden dene"
        >
          <I.refresh size={13} />{retrying ? 'Yenileniyor' : 'Yenile'}
        </button>
      )}
    >
      <div role="status" aria-live="polite" style={{ padding: '4px 0' }}>
        {checks.map((check, index) => {
          const colors = HEALTH_COLORS[check.status]
          return (
            <div key={check.label} style={{
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: index === checks.length - 1 ? 'none' : '1px solid var(--divider)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: colors.dot, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{check.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{check.detail}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: colors.foreground }}>{colors.label}</span>
            </div>
          )
        })}
      </div>
    </PanoCard>
  )
}
