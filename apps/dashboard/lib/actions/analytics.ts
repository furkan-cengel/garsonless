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

export interface AnalyticsPayload {
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  tableStats: TableReportRow[]
  topItems: TopItem[]
  paymentBreakdown: PaymentBreakdown[]
  productReport: ProductReportItem[]
}

export async function fetchAnalyticsData(restaurantId: string, range: string): Promise<AnalyticsPayload> {
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
