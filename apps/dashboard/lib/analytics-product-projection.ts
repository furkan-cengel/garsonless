import type { ProductReportItem } from './queries/analytics'

interface ProductPeriodRow { period: string; name: string; count: number; revenue: number }

/** Compare the union, but allocate ABC bands using current-period kuruş only. */
export function projectAnalyticsProducts(rows: ProductPeriodRow[]): ProductReportItem[] {
  const current = new Map(rows.filter((row) => row.period === 'current').map((row) => [row.name, row]))
  const previous = new Map(rows.filter((row) => row.period === 'previous').map((row) => [row.name, row]))
  const total = [...current.values()].reduce((sum, row) => sum + Math.round(row.revenue * 100), 0)
  let cumulative = 0
  return [...new Set([...current.keys(), ...previous.keys()])].map((name) => {
    const now = current.get(name)
    const revenue = now?.revenue ?? 0
    const before = previous.get(name)?.revenue ?? 0
    return { name, count: now?.count ?? 0, revenue,
      deltaPct: before > 0 ? Math.round((revenue - before) / before * 1000) / 10 : revenue > 0 ? null : 0 }
  }).sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name, 'tr')).map((item) => {
    const amount = Math.round(item.revenue * 100)
    const abcClass: ProductReportItem['abcClass'] = amount <= 0 || total <= 0 ? 'C'
      : cumulative * 100 < total * 80 ? 'A' : cumulative * 100 < total * 95 ? 'B' : 'C'
    cumulative += amount
    return { ...item, abcClass, sharePct: total > 0 ? Math.round(amount / total * 1000) / 10 : 0,
      cumulativePct: total > 0 ? Math.round(cumulative / total * 1000) / 10 : 0 }
  })
}
