import type { ProductReportItem } from '../../lib/queries/analytics'

type ProductClassTotals = Record<ProductReportItem['abcClass'], number>

export function projectProductReport(items: ProductReportItem[]) {
  return items.reduce(
    (projection, item) => {
      projection.totalRevenue += item.revenue
      projection.totalCount += item.count
      if (item.count > 0) projection.productCount += 1
      projection.classTotals[item.abcClass] += item.revenue
      return projection
    },
    {
      totalRevenue: 0,
      totalCount: 0,
      productCount: 0,
      classTotals: { A: 0, B: 0, C: 0 } as ProductClassTotals,
    },
  )
}

export function formatProductDelta(delta: number | null): string {
  if (delta === null) return 'Yeni'
  return `${delta >= 0 ? '+' : ''}${delta.toLocaleString('tr-TR')}%`
}

export function selectProductMovers(items: ProductReportItem[], limit = 4) {
  const risers = items
    .filter((item) => item.deltaPct === null || item.deltaPct > 0)
    .sort((a, b) => (b.deltaPct ?? 999) - (a.deltaPct ?? 999))
    .slice(0, limit)
  const fallers = items
    .filter((item) => item.deltaPct !== null && item.deltaPct < 0)
    .sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0))
    .slice(0, limit)

  return { risers, fallers }
}
