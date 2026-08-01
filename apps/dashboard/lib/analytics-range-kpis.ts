import type { AnalyticsRangeKPIs } from './queries/insights-shared'

interface RangeVolumeRow {
  status: string
  sessionId: string | null
  createdAt: string
}

interface RangeCollectedRow {
  total: number
  paidAt: string
}

/** Pure period projection shared by the server query and regression tests. */
export function projectAnalyticsRangeKpis(
  volumeRows: RangeVolumeRow[],
  collectedRows: RangeCollectedRow[],
  currentStart: Date,
): AnalyticsRangeKPIs {
  const nonCancelled = volumeRows.filter((row) => row.status !== 'cancelled')
  const currentVolume = nonCancelled.filter((row) => new Date(row.createdAt) >= currentStart)
  const previousVolume = nonCancelled.filter((row) => new Date(row.createdAt) < currentStart)
  const currentCollected = collectedRows.filter((row) => new Date(row.paidAt) >= currentStart)
  const previousCollected = collectedRows.filter((row) => new Date(row.paidAt) < currentStart)
  const sum = (rows: RangeCollectedRow[]) => rows.reduce((total, row) => total + row.total, 0)
  const revenue = sum(currentCollected)
  const paidOrders = currentCollected.length

  return {
    revenue,
    previousRevenue: sum(previousCollected),
    orders: currentVolume.length,
    previousOrders: previousVolume.length,
    paidOrders,
    previousPaidOrders: previousCollected.length,
    avgBasket: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
    sessions: new Set(currentVolume.map((row) => row.sessionId).filter(Boolean)).size,
    previousSessions: new Set(previousVolume.map((row) => row.sessionId).filter(Boolean)).size,
  }
}
