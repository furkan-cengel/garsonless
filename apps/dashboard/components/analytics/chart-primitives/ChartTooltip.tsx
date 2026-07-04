'use client'

import type { ReactNode } from 'react'
import { CHART_MONO } from './axis'

export interface TooltipRow {
  label: string
  value: string
  /** Optional swatch color (series/category). */
  color?: string
}

/**
 * THE presentational tooltip card — the single source used by BOTH the recharts
 * `<Tooltip content>` adapter below AND the non-recharts heatmap (P2, via
 * FloatingTooltip). One renderer → identical look everywhere, no dual-render.
 */
export function TooltipCard({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, boxShadow: 'var(--shadow-pop)', padding: '9px 11px',
      minWidth: 130, pointerEvents: 'none',
    }}>
      {title != null && (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: rows.length ? 6 : 0 }}>{title}</div>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          {r.color && <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />}
          <span style={{ flex: 1, fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{r.label}</span>
          <span style={{ fontFamily: CHART_MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** recharts payload item (only the fields we read — real datum, no fabrication). */
export interface RechartsPayloadItem {
  payload?: Record<string, unknown>
  value?: number | string
  name?: string
  dataKey?: string | number
}

interface ChartTooltipProps {
  // Injected by recharts when used as <Tooltip content={<ChartTooltip render={...} />} />
  active?: boolean
  payload?: RechartsPayloadItem[]
  label?: string | number
  /** Per-chart mapping of the hovered datum(s) → tooltip content. Reads ONLY
      real payload fields — never derives or fabricates a value. */
  render: (payload: RechartsPayloadItem[], label: string | number | undefined) => { title?: ReactNode; rows: TooltipRow[] }
}

/** recharts `<Tooltip content>` adapter. Renders nothing unless a point is active. */
export default function ChartTooltip({ active, payload, label, render }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const { title, rows } = render(payload, label)
  if (rows.length === 0) return null
  return <TooltipCard title={title} rows={rows} />
}
