import type { AnalyticsRefundRow } from '@garsonless/application/read-models'
import type { AnalyticsFinancialSummary } from './analytics-financial-model'

export interface PaymentBreakdown {
  key: string
  label: string
  amount: number
  count: number
  pct: number
}

export interface RefundSummary {
  total: number
  count: number
  fullCount: number
  partialCount: number
  netCollected: number
  byMethod: Array<{ key: 'cash' | 'pos' | 'iyzico'; label: string; amount: number; count: number }>
}

export interface PaymentReport {
  collected: PaymentBreakdown[]
  comp: { amount: number; count: number }
  collectedTotal: number
  collectedCount: number
  financials: AnalyticsFinancialSummary
  refunds: RefundSummary
  coverage: { monetaryRefunds: boolean; serviceFees: false; tips: false }
}

const LABELS = { cash: 'Nakit', pos: 'Fiziksel POS', iyzico: 'İyzico' } as const

export function aggregateRefundSummary(
  rows: readonly AnalyticsRefundRow[],
  collectedTotal: number,
): RefundSummary {
  const groups = new Map<AnalyticsRefundRow['paymentMethod'], { amount: number; count: number }>()
  let fullCount = 0
  let partialCount = 0
  for (const refund of rows) {
    const group = groups.get(refund.paymentMethod) ?? { amount: 0, count: 0 }
    group.amount += refund.amount
    group.count += 1
    groups.set(refund.paymentMethod, group)
    if (refund.kind === 'full') fullCount += 1
    else partialCount += 1
  }
  const total = rows.reduce((sum, refund) => sum + refund.amount, 0)
  return {
    total, count: rows.length, fullCount, partialCount, netCollected: collectedTotal - total,
    byMethod: [...groups.entries()].map(([key, value]) => ({ key, label: LABELS[key], ...value }))
      .sort((a, b) => b.amount - a.amount),
  }
}
