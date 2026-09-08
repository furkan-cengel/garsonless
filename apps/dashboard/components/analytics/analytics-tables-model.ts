import type { TableReportRow } from '../../lib/queries/analytics'

export function formatTableDwell(minutes: number | null): string {
  if (minutes === null) return '-'
  if (minutes < 60) return `${minutes}dk`
  return `${Math.floor(minutes / 60)}s ${String(minutes % 60).padStart(2, '0')}dk`
}

export function projectTablesReport(tables: TableReportRow[]) {
  const sortedTables = [...tables].sort((a, b) => b.revenue - a.revenue)
  const projection = sortedTables.reduce(
    (result, table) => {
      result.totalRevenue += table.revenue
      result.totalOrders += table.orders
      result.totalTurnover += table.turnover
      if (table.orders > 0) result.activeTables += 1
      if (table.openNow) result.openNowCount += 1
      if (table.avgDwellMinutes !== null) {
        result.hasDwellData = true
        result.weightedDwellTotal += table.avgDwellMinutes * table.turnover
      }
      return result
    },
    {
      totalRevenue: 0,
      totalOrders: 0,
      totalTurnover: 0,
      activeTables: 0,
      openNowCount: 0,
      hasDwellData: false,
      weightedDwellTotal: 0,
    },
  )

  return {
    sortedTables,
    maxRevenue: Math.max(...sortedTables.map((table) => table.revenue), 1),
    totalRevenue: projection.totalRevenue,
    totalOrders: projection.totalOrders,
    totalTurnover: projection.totalTurnover,
    activeTables: projection.activeTables,
    openNowCount: projection.openNowCount,
    averageRevenue: projection.activeTables > 0
      ? Math.round(projection.totalRevenue / projection.activeTables)
      : null,
    overallDwell: projection.hasDwellData
      ? Math.round(projection.weightedDwellTotal / Math.max(projection.totalTurnover, 1))
      : null,
  }
}
