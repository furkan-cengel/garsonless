'use client'

import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Brush } from 'recharts'
import type { DailySale } from '../../../lib/queries/analytics'
import ChartFrame from './ChartFrame'
import ChartTooltip, { type RechartsPayloadItem } from './ChartTooltip'
import { axisTick, gridProps, chartMargin, bareAxis, tooltipWrapperStyle, CHART_MONO } from './axis'
import { money, moneyTick } from './format'

// FULL tier — the only time-series. Crosshair + single hover tooltip + Brush
// zoom/pan (Çeyrek/Yıl ranges only, where the point count makes it useful).
// The old peak-label <rect>/<text> is DELETED — its value now lives in the
// tooltip, which is the garble fix at the root (no more static label colliding
// with the axis ticks).
export default function SalesLineChart({ data, range }: { data: DailySale[]; range: string }) {
  const total = data.reduce((sum, d) => sum + d.current, 0)
  const prevTotal = data.reduce((sum, d) => sum + d.prev, 0)
  const deltaPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
  const showBrush = range === 'quarter' || range === 'year'

  const renderTip = (payload: RechartsPayloadItem[], label: string | number | undefined) => {
    const cur = payload.find((p) => p.dataKey === 'current')
    const prev = payload.find((p) => p.dataKey === 'prev')
    const rows = []
    if (cur) rows.push({ label: 'Bu dönem', value: money(Number(cur.value) || 0), color: 'var(--chart-series-current)' })
    if (prev) rows.push({ label: 'Önceki dönem', value: money(Number(prev.value) || 0), color: 'var(--chart-series-prev)' })
    return { title: String(label ?? ''), rows }
  }

  return (
    <div style={{ padding: '12px 14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
        <span style={{ fontFamily: CHART_MONO, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--text)' }}>
          {money(total)}
        </span>
        {prevTotal > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999,
            background: deltaPct >= 0 ? 'var(--positive-bg)' : 'var(--critical-bg)',
            color: deltaPct >= 0 ? 'var(--positive)' : 'var(--critical)', fontSize: 10.5, fontWeight: 600,
          }}>{deltaPct >= 0 ? '↑' : '↓'} %{Math.abs(deltaPct).toFixed(1)} önceki dönem</span>
        )}
      </div>
      <ChartFrame height={showBrush ? 300 : 264} isEmpty={data.length === 0} emptyText="Veri yok">
        <ComposedChart data={data} margin={chartMargin}>
          <defs>
            <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-series-current)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--chart-series-current)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...bareAxis} tick={axisTick} minTickGap={22} />
          <YAxis {...bareAxis} tick={axisTick} tickFormatter={moneyTick} width={52} />
          <Tooltip
            wrapperStyle={tooltipWrapperStyle}
            cursor={{ stroke: 'var(--text-4)', strokeDasharray: '3 3' }}
            content={<ChartTooltip render={renderTip} />}
          />
          <Line type="monotone" dataKey="prev" stroke="var(--chart-series-prev)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="current" stroke="var(--chart-series-current)" strokeWidth={2.5} fill="url(#salesAreaGrad)" dot={false} activeDot={{ r: 4, fill: '#fff', stroke: 'var(--chart-series-current)', strokeWidth: 2 }} isAnimationActive={false} />
          {showBrush && (
            <Brush dataKey="date" height={22} stroke="var(--text-4)" travellerWidth={8} tickFormatter={() => ''} />
          )}
        </ComposedChart>
      </ChartFrame>
    </div>
  )
}
