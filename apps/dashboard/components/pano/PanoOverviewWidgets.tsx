import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { EmptyState, I, S } from '../../lib/ui'
import type { HeatmapCell, TopItem } from '../../lib/queries/pano'
import type {
  PanoHealthCheck,
  PanoHealthStatus,
  PanoKpiCardModel,
  PanoQuickAction,
  PanoQuickActionKey,
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
  const trendBackground = model.trend === 'up' ? 'var(--positive-bg)' : 'var(--critical-bg)'
  const trendForeground = model.trend === 'up' ? 'var(--positive)' : 'var(--critical)'

  return (
    <Link
      href={model.href}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      className="pano-kpi-link"
    >
      <div style={{
        background: model.featured ? 'linear-gradient(135deg, #18181b 0%, #2a2a30 100%)' : 'var(--surface)',
        color: model.featured ? '#fff' : 'var(--text)',
        borderRadius: 12, border: `1px solid ${model.featured ? 'transparent' : 'var(--border)'}`,
        padding: 16, position: 'relative', overflow: 'hidden',
        transition: 'background 120ms, border-color 120ms, transform 120ms, box-shadow 120ms',
      }}>
        {model.featured && (
          <div style={{
            position: 'absolute', top: -20, right: -20, width: 120, height: 120,
            background: 'radial-gradient(circle, rgba(255,208,137,.15) 0%, transparent 65%)',
            pointerEvents: 'none',
          }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 500,
            color: model.featured ? 'rgba(255,255,255,.55)' : 'var(--text-3)',
            letterSpacing: '.05em', textTransform: 'uppercase',
          }}>{model.label}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 999,
            background: model.featured ? 'rgba(94, 232, 164, .15)' : trendBackground,
            color: model.featured ? '#5ee8a4' : trendForeground,
            fontSize: 10.5, fontWeight: 600,
          }}>{model.trend === 'up' ? '↑' : '↓'}{model.delta}</span>
        </div>
        <div style={{
          fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1,
          ...S.mono, color: model.featured ? '#ffd089' : 'var(--text)',
        }}>{model.value}</div>
        <div style={{ fontSize: 11, color: model.featured ? 'rgba(255,255,255,.55)' : 'var(--text-3)', marginTop: 6 }}>{model.sub}</div>
      </div>
    </Link>
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
  const grid: Record<string, number> = {}
  let maximum = 0
  for (const cell of heatmap) {
    grid[`${cell.day}-${cell.hour}`] = cell.count
    if (cell.count > maximum) maximum = cell.count
  }

  return (
    <PanoCard title="Yoğun saatler" subtitle="Son 30 gün · sipariş yoğunluğu">
      {maximum === 0 ? (
        <EmptyState title="Yeterli veri yok" sub="Siparişler biriktikçe yoğun saatler burada görünür" />
      ) : (
        <div style={{ padding: 14 }}>
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
                    return (
                      <div
                        key={`${day}-${hour}`}
                        title={`${day} ${String(hour).padStart(2, '0')}:00 · ${count} sipariş`}
                        style={{
                          aspectRatio: '1', borderRadius: 1.5,
                          background: count === 0 ? 'var(--surface-3)' : `rgba(47, 111, 78, ${0.18 + intensity * 0.82})`,
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
      )}
    </PanoCard>
  )
}

const QUICK_ACTION_ICONS: Record<PanoQuickActionKey, ReactNode> = {
  menu: <I.plus size={15} />,
  tables: <I.qr size={15} />,
  theme: <I.palette size={15} />,
  orders: <I.clipboard size={15} />,
  analytics: <I.chart size={15} />,
}

export function PanoQuickActions({ actions }: { actions: PanoQuickAction[] }) {
  return (
    <PanoCard title="Hızlı işlemler" subtitle="Yetkili olduğun bölümler">
      <div style={{ padding: 8 }}>
        {actions.length === 0
          ? <EmptyState title="Kullanılabilir işlem yok" sub="Bu hesap yalnız Pano görüntüleme yetkisine sahip" />
          : actions.map((action) => (
            <Link className="pano-quick-action" key={action.key} href={action.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', marginBottom: 1, borderRadius: 7,
              background: 'transparent', textDecoration: 'none',
            }}>
              <div className="pano-quick-icon" style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--surface-3)', color: 'var(--text-2)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 140ms ease, color 140ms ease, box-shadow 140ms ease',
              }}>{QUICK_ACTION_ICONS[action.key]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{action.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{action.description}</div>
              </div>
              <span style={{ color: 'var(--text-4)', display: 'inline-flex' }}><I.chevRight size={13} /></span>
            </Link>
          ))}
      </div>
    </PanoCard>
  )
}

const HEALTH_COLORS: Record<PanoHealthStatus, { dot: string; foreground: string; label: string }> = {
  ok: { dot: 'var(--positive)', foreground: 'var(--positive)', label: 'Aktif' },
  warn: { dot: 'var(--warning)', foreground: 'var(--warning)', label: 'Dikkat' },
  down: { dot: 'var(--critical)', foreground: 'var(--critical)', label: 'Yok' },
  idle: { dot: 'var(--text-4)', foreground: 'var(--text-3)', label: '—' },
}

export function PanoSystemHealth({ checks }: { checks: PanoHealthCheck[] }) {
  return (
    <PanoCard title="Bağlantı durumu" subtitle="Gerçek zamanlı sinyaller">
      <div style={{ padding: '4px 0' }}>
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
