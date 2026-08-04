'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { S } from '../../lib/ui'
import {
  PANO_CHART_RANGES,
  hourInTimezone,
  navigatePanoChartIndex,
  type PanoChartData,
  type PanoChartNavigationKey,
  type PanoChartPoint,
  type PanoChartRange,
} from '../../lib/pano-chart-model'
import { PanoCard } from './PanoOverviewWidgets'

export function PanoSalesChart({
  data,
  error,
  isPending,
  timezone,
  onSelectRange,
  now,
}: {
  data: PanoChartData
  error: string
  isPending: boolean
  timezone: string
  onSelectRange: (range: PanoChartRange, force?: boolean) => void
  now: Date
}) {
  const [tooltip, setTooltip] = useState<{ point: PanoChartPoint; x: number; y: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showTable, setShowTable] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const width = 720
  const height = 220
  const horizontalPadding = 28
  const verticalPadding = 20
  const points = data.points
  const maximum = Math.max(...points.map((point) => point.value), 1)
  const slot = (width - horizontalPadding * 2) / Math.max(points.length, 1)
  const barWidth = Math.max(2, slot - 6)
  const labelStep = points.length > 16 ? Math.ceil(points.length / 8) : 2
  const isDay = data.range === 'day'
  const safeActiveIndex = Math.min(activeIndex, Math.max(points.length - 1, 0))
  const activePoint = points[safeActiveIndex]

  const showPoint = (index: number) => {
    const point = points[index]
    const bounds = chartRef.current?.getBoundingClientRect()
    if (!point || !bounds) return
    setActiveIndex(index)
    setTooltip({ point, x: ((index + 0.5) / Math.max(points.length, 1)) * bounds.width, y: 32 })
  }

  const onChartKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    showPoint(navigatePanoChartIndex(safeActiveIndex, points.length, event.key as PanoChartNavigationKey))
  }

  return (
    <PanoCard title="Tahsilat akışı" subtitle={isDay ? 'Saatlik tahsilat · TRY' : `${data.rangeLabel} · günlük tahsilat · TRY`}>
      <div aria-busy={isPending} style={{ padding: '12px 16px 16px' }}>
        <div className="pano-chart-head" style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <span style={{ ...S.mono, fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', opacity: isPending ? 0.5 : 1 }}>
            ₺{data.total.toLocaleString('tr-TR')}
          </span>
          {isPending && <span role="status" aria-live="polite" style={{ fontSize: 11, color: 'var(--text-3)' }}>Tahsilat grafiği yükleniyor…</span>}
          <div className="pano-chart-ranges" role="group" aria-label="Tahsilat grafiği tarih aralığı" style={{ marginLeft: 'auto', display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 6, padding: 2 }}>
            {PANO_CHART_RANGES.map(({ label, range }) => (
              <button type="button" className="pano-range-action" key={range} onClick={() => onSelectRange(range)} disabled={isPending} aria-pressed={data.range === range} style={{
                padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
                background: data.range === range ? 'var(--surface)' : 'transparent',
                color: data.range === range ? 'var(--text)' : 'var(--text-2)',
                boxShadow: data.range === range ? 'var(--shadow-1)' : 'none',
                border: 'none', borderRadius: 4, cursor: isPending ? 'default' : 'pointer',
              }}>{label}</button>
            ))}
          </div>
        </div>
        {error ? (
          <div role="alert" style={{ padding: '38px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--critical)' }}>
            <div>{error}</div>
            <button type="button" className="pano-data-toggle" onClick={() => onSelectRange(data.range, true)} style={{ marginTop: 8, color: 'inherit', textDecoration: 'underline' }}>Yeniden dene</button>
          </div>
        ) : data.total === 0 ? (
          <div style={{ padding: '46px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>Bu aralıkta tahsilat yok</div>
        ) : (
          <div
            ref={chartRef}
            className="pano-chart-keyboard"
            role="group"
            tabIndex={0}
            aria-label={`${data.rangeLabel} tahsilat grafiği. Ok tuşlarıyla veri noktaları arasında gezinin.`}
            aria-describedby="pano-chart-active-point"
            style={{ position: 'relative', borderRadius: 6 }}
            onFocus={() => showPoint(safeActiveIndex)}
            onKeyDown={onChartKeyDown}
            onMouseLeave={() => setTooltip(null)}
          >
            <span id="pano-chart-active-point" className="sr-only" aria-live="polite">
              {activePoint ? `${activePoint.label}${isDay ? ':00' : ''}, ₺${activePoint.value.toLocaleString('tr-TR')}` : 'Veri noktası yok'}
            </span>
            <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block', opacity: isPending ? 0.5 : 1, transition: 'opacity 120ms' }} preserveAspectRatio="xMidYMid meet">
              {[0, 0.25, 0.5, 0.75, 1].map((position) => {
                const y = verticalPadding + (height - verticalPadding * 2) * (1 - position)
                return <line key={position} x1={horizontalPadding} y1={y} x2={width - horizontalPadding} y2={y} stroke="var(--divider)" strokeWidth="1" strokeDasharray={position === 0 ? 'none' : '3,3'} />
              })}
              {points.map((point, index) => {
                const x = horizontalPadding + index * slot + (slot - barWidth) / 2
                const barHeight = (height - verticalPadding * 2) * (point.value / maximum)
                const y = height - verticalPadding - barHeight
                const fill = point.highlight ? '#ffd089' : point.value === 0 ? 'var(--surface-3)' : 'var(--text)'
                return (
                  <g key={point.label + index}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight || 2}
                      rx="3"
                      fill={fill}
                      opacity={point.value === 0 ? 0.4 : 1}
                      style={{ cursor: 'crosshair', outline: 'none' }}
                      onMouseMove={(event) => {
                        const bounds = chartRef.current?.getBoundingClientRect()
                        if (!bounds) return
                        setTooltip({ point, x: event.clientX - bounds.left, y: event.clientY - bounds.top })
                      }}
                      onClick={() => showPoint(index)}
                    />
                    {point.highlight && <circle cx={x + barWidth / 2} cy={y - 6} r="3" fill="#ffd089" />}
                  </g>
                )
              })}
              {points.map((point, index) => (index % labelStep === 0 ? (
                <text key={`label-${index}`} x={horizontalPadding + index * slot + slot / 2} y={height - 4} fontSize="10" fill="var(--text-3)" textAnchor="middle" fontFamily="Geist Mono, monospace">
                  {point.label}
                </text>
              ) : null))}
            </svg>
            {tooltip && (
              <div role="tooltip" style={{
                position: 'absolute', zIndex: 4,
                left: Math.max(72, Math.min(tooltip.x, (chartRef.current?.clientWidth ?? 200) - 72)),
                top: Math.max(8, tooltip.y - 76), transform: 'translateX(-50%)',
                minWidth: 132, padding: '9px 11px', borderRadius: 9,
                color: '#fff', background: 'rgba(17,17,19,.94)', boxShadow: 'var(--shadow-pop)',
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.65)' }}>
                  {isDay ? `${tooltip.point.label}:00` : tooltip.point.label}
                </div>
                <div style={{ ...S.mono, marginTop: 2, fontSize: 15, fontWeight: 750 }}>
                  ₺{tooltip.point.value.toLocaleString('tr-TR')}
                </div>
                <div style={{ marginTop: 2, fontSize: 10, color: 'rgba(255,255,255,.65)' }}>
                  {data.total > 0 ? `Toplamın %${Math.round((tooltip.point.value / data.total) * 100)}` : 'Bu aralıkta tahsilat yok'}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{
          display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)',
          marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--divider)', flexWrap: 'wrap',
        }}>
          <ChartLegendDot color="var(--text)" label={`Tahsilat ₺${data.total.toLocaleString('tr-TR')}`} />
          {isDay && <ChartLegendDot color="#ffd089" label={`Şu an ${String(hourInTimezone(timezone, now)).padStart(2, '0')}:00`} />}
          {data.peakValue > 0 && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {isDay ? 'Pik saat' : 'Pik gün'} <span style={{ ...S.mono, color: 'var(--text-2)', fontWeight: 600 }}>
                {isDay ? `${data.peakLabel}:00` : data.peakLabel} ₺{data.peakValue.toLocaleString('tr-TR')}
              </span>
            </span>
          )}
        </div>
        {data.total > 0 && (
          <>
            <button
              type="button"
              className="pano-data-toggle"
              aria-expanded={showTable}
              aria-controls="pano-sales-data-table"
              onClick={() => setShowTable((visible) => !visible)}
              style={{ marginTop: 8 }}
            >
              {showTable ? 'Veri tablosunu gizle' : 'Veriyi tablo olarak göster'}
            </button>
            {showTable && (
              <div id="pano-sales-data-table" className="pano-data-table-scroll" style={{ marginTop: 8 }}>
                <table className="pano-data-table">
                  <caption className="sr-only">{data.rangeLabel} tahsilat değerleri</caption>
                  <thead><tr><th scope="col">{isDay ? 'Saat' : 'Gün'}</th><th scope="col">Tahsilat</th></tr></thead>
                  <tbody>
                    {points.map((point, index) => (
                      <tr key={`${point.label}-${index}`}><th scope="row">{point.label}{isDay ? ':00' : ''}</th><td>₺{point.value.toLocaleString('tr-TR')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </PanoCard>
  )
}

function ChartLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  )
}
