'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Sector, ResponsiveContainer } from 'recharts'
import type { PaymentBreakdown } from '../../../lib/queries'
import ChartTooltip, { type RechartsPayloadItem } from './ChartTooltip'
import { tooltipWrapperStyle } from './axis'
import { money, percent } from './format'

const CAT = ['var(--chart-cat-1)', 'var(--chart-cat-2)', 'var(--chart-cat-3)', 'var(--chart-cat-4)', 'var(--chart-cat-5)']

// HOVER tier. Fed ONLY `.collected` (comp/İkram is never a slice — same as
// before). Hover pops the arc out (activeShape) + shows the ChartTooltip; İkram
// is surfaced separately by the caller, never inside this pie or its tooltip.
export default function PaymentDonutChart({ segments }: { segments: PaymentBreakdown[] }) {
  const [active, setActive] = useState<number | null>(null)
  const total = segments.reduce((sum, s) => sum + s.amount, 0)
  const totalCount = segments.reduce((sum, s) => sum + s.count, 0)

  if (segments.length === 0 || total <= 0) {
    return (
      <div style={{ padding: '46px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Bu aralıkta tahsil edilmiş ödeme yok
      </div>
    )
  }

  const renderTip = (payload: RechartsPayloadItem[]) => {
    const seg = payload[0]?.payload as PaymentBreakdown | undefined
    if (!seg) return { rows: [] }
    return {
      title: seg.label,
      rows: [
        { label: 'Tutar', value: money(seg.amount), color: CAT[segments.indexOf(seg) % CAT.length] },
        { label: 'Pay', value: percent(seg.pct) },
        { label: 'Adet', value: String(seg.count) },
      ],
    }
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: '100%', height: 176 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments} dataKey="amount" nameKey="label"
              cx="50%" cy="50%" innerRadius="62%" outerRadius="94%"
              startAngle={90} endAngle={-270} paddingAngle={1.5}
              isAnimationActive={false} stroke="none"
              activeIndex={active ?? undefined}
              activeShape={(props: object) => {
                const p = props as { outerRadius: number } & Record<string, unknown>
                return <Sector {...p} outerRadius={p.outerRadius + 6} />
              }}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {segments.map((s, i) => <Cell key={s.key} fill={CAT[i % CAT.length]} />)}
            </Pie>
            <Tooltip wrapperStyle={tooltipWrapperStyle} content={<ChartTooltip render={renderTip} />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{money(total)}</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{totalCount} ödeme</span>
        </div>
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((seg, i) => (
          <div key={seg.key}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', opacity: active === null || active === i ? 1 : 0.5, transition: 'opacity .12s' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT[i % CAT.length] }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{seg.label}</span>
            <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 11, color: 'var(--text-3)' }}>{percent(seg.pct)}</span>
            <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 11.5, fontWeight: 600, minWidth: 74, textAlign: 'right', color: 'var(--text)' }}>{money(seg.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
