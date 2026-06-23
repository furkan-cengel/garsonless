'use server'

import {
  getSalesOverTime,
  getHeatmapData,
  getTablesReportData,
  getTopItems,
  getPaymentBreakdown,
  getProductReportData,
} from '../queries'
import type {
  DailySale,
  HeatmapCell,
  TableReportRow,
  TopItem,
  PaymentBreakdown,
  ProductReportItem,
} from '../queries'
import { assertAccess } from '../auth/access'

const EMPTY_ANALYTICS: AnalyticsPayload = {
  salesOverTime: [], heatmapData: [], tableStats: [], topItems: [], paymentBreakdown: [], productReport: [],
}

export interface AnalyticsPayload {
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  tableStats: TableReportRow[]
  topItems: TopItem[]
  paymentBreakdown: PaymentBreakdown[]
  productReport: ProductReportItem[]
}

export async function fetchAnalyticsData(restaurantId: string, range: string): Promise<AnalyticsPayload> {
  // Owner OR a member with 'analytics'. Denied → empty payload (no data).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return EMPTY_ANALYTICS

  const [salesOverTime, heatmapData, tableStats, topItems, paymentBreakdown, productReport] = await Promise.all([
    getSalesOverTime(restaurantId, range),
    getHeatmapData(restaurantId),
    getTablesReportData(restaurantId),
    getTopItems(restaurantId, range),
    getPaymentBreakdown(restaurantId, range),
    getProductReportData(restaurantId, range),
  ])
  return { salesOverTime, heatmapData, tableStats, topItems, paymentBreakdown, productReport }
}
