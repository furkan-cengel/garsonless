'use client'

import { Fragment, useState } from 'react'
import type { HeatmapCell } from '../../../lib/queries'
import FloatingTooltip from './FloatingTooltip'
import { TooltipCard } from './ChartTooltip'
import { count } from './format'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

// HOVER tier — stays a CSS grid (recharts has no heatmap). Hover a cell →
// FloatingTooltip (follow-cursor, escapes the Card) with the real day/hour/count.
// No always-on labels, so no garble; empty data → honest empty message.
export default function HeatmapGrid({ data }: { data: HeatmapCell[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; day: number; hour: number; n: number } | null>(null)

  if (data.length === 0) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Veri yok</div>
  }

  const lookup = new Map<string, number>()
  let maxCount = 1
  for (const cell of data) {
    lookup.set(`${cell.day}-${cell.hour}`, cell.count)
    if (cell.count > maxCount) maxCount = cell.count
  }

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(15, 1fr)', gap: 3, alignItems: 'center' }}>
        <span />
        {Array.from({ length: 15 }, (_, h) => (
          <span key={h} style={{ fontSize: 9, color: 'var(--text-4)', textAlign: 'center', fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{h + 8}</span>
        ))}
        {DAYS.map((d, dayIdx) => (
          <Fragment key={d}>
            <span style={{ fontSize: 10, color: 'var(--text-3)', paddingRight: 6, fontWeight: 500 }}>{d}</span>
            {Array.from({ length: 15 }, (_, hIdx) => {
              const hour = hIdx + 8
              const n = lookup.get(`${dayIdx}-${hour}`) ?? 0
              const v = n / maxCount
              return (
                <div
                  key={hIdx}
                  onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, day: dayIdx, hour, n })}
                  onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                  onMouseLeave={() => setTip(null)}
                  style={{
                    aspectRatio: '1', borderRadius: 2, cursor: 'default',
                    background: v === 0 ? 'var(--surface-3)' : `rgba(31, 78, 143, ${Math.max(0.1, v)})`,
                    outline: tip && tip.day === dayIdx && tip.hour === hour ? '1.5px solid var(--text)' : 'none',
                  }}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
      <FloatingTooltip x={tip?.x ?? 0} y={tip?.y ?? 0} visible={tip !== null}>
        {tip && (
          <TooltipCard
            title={`${DAYS[tip.day]} · ${String(tip.hour).padStart(2, '0')}:00`}
            rows={[{ label: 'Sipariş', value: count(tip.n) }]}
          />
        )}
      </FloatingTooltip>
    </div>
  )
}
