'use client'

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts'
import type { ProductReportItem } from '../../../lib/queries'
import ChartFrame from './ChartFrame'
import ChartTooltip, { type RechartsPayloadItem } from './ChartTooltip'
import { axisTick, gridProps, bareAxis, tooltipWrapperStyle } from './axis'
import { money, percent, count } from './format'

const ABC_COLOR: Record<ProductReportItem['abcClass'], string> = {
  A: 'var(--chart-abc-a)',
  B: 'var(--chart-abc-b)',
  C: 'var(--chart-abc-c)',
}

// HOVER tier — the highest-priority garble fix. The old chart painted a
// permanent <text> name label above every one of 14 bubbles; clustered points
// turned those into overlapping mush. Here there are ZERO always-on labels —
// name/count/share/revenue/class surface ONLY in the single hover tooltip.
export default function ProductScatterChart({ items }: { items: ProductReportItem[] }) {
  const plot = items.slice(0, 14)
  const xMax = Math.max(...plot.map((i) => i.count), 1)
  const yMax = Math.max(...plot.map((i) => i.sharePct), 1)

  const renderTip = (payload: RechartsPayloadItem[]) => {
    const it = payload[0]?.payload as ProductReportItem | undefined
    if (!it) return { rows: [] }
    return {
      title: it.name,
      rows: [
        { label: 'Adet', value: count(it.count) },
        { label: 'Tahsilat payı', value: percent(it.sharePct) },
        { label: 'Tutar', value: money(it.revenue) },
        { label: 'Sınıf', value: it.abcClass, color: ABC_COLOR[it.abcClass] },
      ],
    }
  }

  return (
    <div style={{ padding: 8 }}>
      <ChartFrame height={272} isEmpty={items.length === 0} emptyText="Bu aralıkta ürün verisi yok">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 12 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            type="number" dataKey="count" name="Hacim" {...bareAxis} tick={axisTick}
            domain={[0, Math.ceil(xMax * 1.1)]}
            label={{ value: 'Hacim (adet)', position: 'insideBottom', offset: -12, fontSize: 10, fill: 'var(--chart-axis-text)' }}
          />
          <YAxis
            type="number" dataKey="sharePct" name="Pay" {...bareAxis} tick={axisTick} tickFormatter={percent} width={46}
            domain={[0, Math.ceil(yMax * 1.1)]}
            label={{ value: 'Tahsilat payı', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--chart-axis-text)' }}
          />
          <ZAxis type="number" dataKey="revenue" range={[70, 420]} name="Tutar" />
          <ReferenceLine x={xMax / 2} stroke="var(--text-4)" strokeDasharray="4 4" />
          <ReferenceLine y={yMax / 2} stroke="var(--text-4)" strokeDasharray="4 4" />
          <Tooltip
            wrapperStyle={tooltipWrapperStyle}
            cursor={{ strokeDasharray: '3 3', stroke: 'var(--text-4)' }}
            content={<ChartTooltip render={renderTip} />}
          />
          <Scatter data={plot} isAnimationActive={false}>
            {plot.map((it) => (
              <Cell key={it.name} fill={ABC_COLOR[it.abcClass]} fillOpacity={0.56} stroke={ABC_COLOR[it.abcClass]} strokeWidth={1.5} />
            ))}
          </Scatter>
        </ScatterChart>
      </ChartFrame>
    </div>
  )
}
