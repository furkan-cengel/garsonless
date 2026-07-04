'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import ChartFrame from './ChartFrame'
import ChartTooltip, { type RechartsPayloadItem } from './ChartTooltip'
import { axisTick, gridProps, chartMargin, bareAxis, tooltipWrapperStyle } from './axis'
import { count } from './format'

// HOVER tier. The compaction (compactCancellationTrend) stays in the caller;
// this just renders the {label,count}[] as bars with one hover tooltip.
export default function CancellationTrendChart({ data }: { data: Array<{ label: string; count: number }> }) {
  const renderTip = (payload: RechartsPayloadItem[]) => {
    const d = payload[0]?.payload as { label: string; count: number } | undefined
    if (!d) return { rows: [] }
    return { title: d.label, rows: [{ label: 'İptal', value: count(d.count), color: 'var(--critical)' }] }
  }

  return (
    <ChartFrame height={148} isEmpty={data.length === 0} emptyText="Bu dönemde iptal yok">
      <BarChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...bareAxis} tick={axisTick} interval={0} />
        <YAxis {...bareAxis} tick={axisTick} allowDecimals={false} width={26} />
        <Tooltip wrapperStyle={tooltipWrapperStyle} cursor={{ fill: 'var(--surface-3)' }} content={<ChartTooltip render={renderTip} />} />
        <Bar dataKey="count" fill="var(--critical)" radius={[5, 5, 2, 2]} maxBarSize={48} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  )
}
