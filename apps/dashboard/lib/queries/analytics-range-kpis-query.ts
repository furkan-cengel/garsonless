import {
  getAnalyticsCoreMetrics,
  type AnalyticsCoreMetrics,
  type AnalyticsRangeKPIs,
} from './insights-shared'
import type { AnalyticsQuery } from '../analytics-filter-contract'

export async function getAnalyticsRangeKPIs(
  restaurantId: string,
  range: string | AnalyticsQuery = 'week',
  asOf = new Date(),
  coreSource?: AnalyticsCoreMetrics,
): Promise<AnalyticsRangeKPIs> {
  const source = coreSource ?? await getAnalyticsCoreMetrics(restaurantId, range, asOf)
  return {
    revenue: source.currentRevenue,
    previousRevenue: source.previousRevenue,
    orders: source.currentOrders,
    previousOrders: source.previousOrders,
    paidOrders: source.currentPaidOrders,
    previousPaidOrders: source.previousPaidOrders,
    avgBasket: source.currentPaidOrders > 0
      ? Math.round(source.currentRevenue / source.currentPaidOrders)
      : 0,
    sessions: source.currentSessions,
    previousSessions: source.previousSessions,
  }
}
