import type { AnalyticsPaymentAggregate } from '@garsonless/application/read-models'
import type { PaymentReport } from './analytics-payment-model'

const METHOD_LABELS: Record<string, string> = {
  iyzico: 'İyzico', cash: 'Nakit', pos: 'Fiziksel POS', split: 'Hesap bölüşme', unknown: 'Bilinmiyor (eski)',
}
const REFUND_LABELS = { cash: 'Nakit', pos: 'Fiziksel POS', iyzico: 'İyzico' } as const

export function projectPaymentAggregate(aggregate: AnalyticsPaymentAggregate): PaymentReport {
  const compGroup = aggregate.groups.find((group) => group.paymentMethod === 'comp')
  const collectedGroups = aggregate.groups.filter((group) => group.paymentMethod !== 'comp').map((group) => {
    const key = group.paymentMethod === 'iyzico' || group.paymentMethod === 'cash'
      || group.paymentMethod === 'pos' || group.paymentMethod === 'split' ? group.paymentMethod : 'unknown'
    return { key, label: METHOD_LABELS[key]!, amount: group.amount, count: group.count }
  })
  const collectedTotal = collectedGroups.reduce((sum, group) => sum + group.amount, 0)
  const collectedCount = collectedGroups.reduce((sum, group) => sum + group.count, 0)
  return {
    collected: collectedGroups.map((group) => ({
      ...group, pct: collectedTotal > 0 ? Math.round((group.amount / collectedTotal) * 1000) / 10 : 0,
    })).sort((a, b) => b.amount - a.amount),
    comp: { amount: compGroup?.amount ?? 0, count: compGroup?.count ?? 0 },
    collectedTotal,
    collectedCount,
    financials: aggregate.financials,
    refunds: {
      total: aggregate.refunds.total,
      count: aggregate.refunds.count,
      fullCount: aggregate.refunds.fullCount,
      partialCount: aggregate.refunds.partialCount,
      netCollected: collectedTotal - aggregate.refunds.total,
      byMethod: aggregate.refunds.groups.map((group) => ({
        key: group.paymentMethod, label: REFUND_LABELS[group.paymentMethod], amount: group.amount, count: group.count,
      })).sort((a, b) => b.amount - a.amount),
    },
    coverage: { monetaryRefunds: true, serviceFees: false, tips: false },
  }
}
