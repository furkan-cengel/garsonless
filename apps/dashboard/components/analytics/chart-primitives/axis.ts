// Shared recharts axis / grid / margin presets — one look across every chart.
// Colors come from the chart tokens (globals.css :root), fonts from --font-mono.

import type { CSSProperties } from 'react'

export const CHART_MONO = "'Geist Mono', ui-monospace, monospace"

/** Axis tick text style (recharts XAxis/YAxis `tick`). */
export const axisTick = {
  fill: 'var(--chart-axis-text)',
  fontSize: 10,
  fontFamily: CHART_MONO,
} as const

/** Dashed gridline props (recharts CartesianGrid). */
export const gridProps = {
  stroke: 'var(--chart-grid)',
  strokeDasharray: '3 3',
  vertical: false,
} as const

/** Standard chart body margins (leaves room for axis labels, no clipping). */
export const chartMargin = { top: 16, right: 20, bottom: 8, left: 8 } as const

/** recharts axisLine/tickLine off — the grid carries the structure. */
export const bareAxis = { axisLine: false, tickLine: false } as const

/** Tooltip wrapper style — z above the card, below app modals (120+). */
export const tooltipWrapperStyle: CSSProperties = { zIndex: 40, outline: 'none' }
