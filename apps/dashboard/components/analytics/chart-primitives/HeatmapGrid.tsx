'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import type { HeatmapCell } from '../../../lib/queries/analytics'
import FloatingTooltip from './FloatingTooltip'
import { TooltipCard } from './ChartTooltip'
import { count } from './format'
import AccessibleChartData from './AccessibleChartData'
import { HEATMAP_FIRST_HOUR, HEATMAP_LAST_HOUR, moveHeatmapFocus, type HeatmapFocus } from './heatmap-accessibility-model'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

// HOVER tier — stays a CSS grid (recharts has no heatmap). Hover a cell →
// FloatingTooltip (follow-cursor, escapes the Card) with the real day/hour/count.
// No always-on labels, so no garble; empty data → honest empty message.
export default function HeatmapGrid({ data }: { data: HeatmapCell[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; day: number; hour: number; n: number } | null>(null)
  const [focus, setFocus] = useState<HeatmapFocus>({ day: 0, hour: HEATMAP_FIRST_HOUR })
  const cells = useRef(new Map<string, HTMLButtonElement>())

  if (data.length === 0) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Veri yok</div>
  }

  const lookup = new Map<string, number>()
  let maxCount = 1
  for (const cell of data) {
    lookup.set(`${cell.day}-${cell.hour}`, cell.count)
    if (cell.count > maxCount) maxCount = cell.count
  }

  const total = data.reduce((sum, cell) => sum + cell.count, 0)
  const peak = data.reduce<HeatmapCell | null>((best, cell) => (!best || cell.count > best.count ? cell : best), null)

  const showTipForElement = (element: HTMLElement, day: number, hour: number, n: number) => {
    const rect = element.getBoundingClientRect()
    setTip({ x: rect.left + rect.width / 2, y: rect.bottom, day, hour, n })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, day: number, hour: number) => {
    const next = moveHeatmapFocus({ day, hour }, event.key)
    if (next.day === day && next.hour === hour && !['Home', 'End'].includes(event.key)) return
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    setFocus(next)
    cells.current.get(`${next.day}-${next.hour}`)?.focus()
  }

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div className="analytics-heatmap-scroll">
        <div
          className="analytics-heatmap-grid"
          role="grid"
          aria-label="Gün ve saate göre sipariş yoğunluğu. Ok tuşlarıyla hücreler arasında gezinin."
          aria-rowcount={7}
          aria-colcount={15}
          style={{ display: 'grid', gridTemplateColumns: '28px repeat(15, minmax(44px, 1fr))', gap: 3, alignItems: 'center' }}
        >
          <span aria-hidden="true" />
          {Array.from({ length: 15 }, (_, h) => (
            <span role="columnheader" key={h} style={{ fontSize: 9, color: 'var(--text-4)', textAlign: 'center', fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{h + 8}</span>
          ))}
          {DAYS.map((d, dayIdx) => (
            <div role="row" key={d} style={{ display: 'contents' }}>
              <span role="rowheader" style={{ fontSize: 10, color: 'var(--text-3)', paddingRight: 6, fontWeight: 500 }}>{d}</span>
              {Array.from({ length: 15 }, (_, hIdx) => {
                const hour = hIdx + 8
                const n = lookup.get(`${dayIdx}-${hour}`) ?? 0
                const v = n / maxCount
                return (
                  <button
                    ref={(element) => {
                      const key = `${dayIdx}-${hour}`
                      if (element) cells.current.set(key, element)
                      else cells.current.delete(key)
                    }}
                    className="analytics-heatmap-cell"
                    key={hIdx}
                    type="button"
                    role="gridcell"
                    aria-label={`${d} ${String(hour).padStart(2, '0')}:00, ${count(n)} sipariş`}
                    tabIndex={focus.day === dayIdx && focus.hour === hour ? 0 : -1}
                    onFocus={(event) => {
                      setFocus({ day: dayIdx, hour })
                      showTipForElement(event.currentTarget, dayIdx, hour, n)
                    }}
                    onBlur={() => setTip(null)}
                    onKeyDown={(event) => handleKeyDown(event, dayIdx, hour)}
                    onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, day: dayIdx, hour, n })}
                    onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                    onMouseLeave={() => setTip(null)}
                    style={{
                      width: '100%', aspectRatio: '1', padding: 0, border: 0, borderRadius: 2, cursor: 'pointer',
                      background: v === 0 ? 'var(--surface-3)' : `rgba(31, 78, 143, ${Math.max(0.1, v)})`,
                      outline: tip && tip.day === dayIdx && tip.hour === hour ? '1.5px solid var(--text)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <FloatingTooltip x={tip?.x ?? 0} y={tip?.y ?? 0} visible={tip !== null}>
        {tip && (
          <TooltipCard
            title={`${DAYS[tip.day]} · ${String(tip.hour).padStart(2, '0')}:00`}
            rows={[{ label: 'Sipariş', value: count(tip.n) }]}
          />
        )}
      </FloatingTooltip>
      <AccessibleChartData
        caption="Gün ve saate göre sipariş yoğunluğu"
        summary={`Toplam ${count(total)} sipariş${peak ? `; en yoğun hücre ${DAYS[peak.day]} ${String(peak.hour).padStart(2, '0')}:00, ${count(peak.count)} sipariş` : ''}.`}
        columns={[
          { key: 'day', label: 'Gün' },
          { key: 'hour', label: 'Saat' },
          { key: 'orders', label: 'Sipariş', align: 'right' },
        ]}
        rows={DAYS.flatMap((day, dayIndex) => Array.from(
          { length: HEATMAP_LAST_HOUR - HEATMAP_FIRST_HOUR + 1 },
          (_, hourIndex) => {
            const hour = hourIndex + HEATMAP_FIRST_HOUR
            return { day, hour: `${String(hour).padStart(2, '0')}:00`, orders: lookup.get(`${dayIndex}-${hour}`) ?? 0 }
          },
        ))}
      />
    </div>
  )
}
