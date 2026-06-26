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
  PaymentReport,
  ProductReportItem,
} from '../queries'
import { assertAccess } from '../auth/access'

const EMPTY_ANALYTICS: AnalyticsPayload = {
  salesOverTime: [], heatmapData: [], tableStats: [], topItems: [],
  paymentBreakdown: { collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0 },
  productReport: [],
}

const EMPTY_PAYMENT_REPORT: PaymentReport = {
  collected: [],
  comp: { amount: 0, count: 0 },
  collectedTotal: 0,
  collectedCount: 0,
}

export interface AnalyticsPayload {
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  tableStats: TableReportRow[]
  topItems: TopItem[]
  paymentBreakdown: PaymentReport
  productReport: ProductReportItem[]
}

export type AnalyticsReportId = 'sales' | 'items' | 'tables' | 'payments'

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

export async function fetchAnalyticsReportData(
  restaurantId: string,
  range: string,
  report: AnalyticsReportId,
): Promise<Partial<AnalyticsPayload>> {
  // Owner OR a member with 'analytics'. Denied → empty payload (no data).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) {
    if (report === 'sales') {
      return {
        salesOverTime: [],
        heatmapData: [],
        topItems: [],
        paymentBreakdown: EMPTY_PAYMENT_REPORT,
      }
    }
    if (report === 'items') return { productReport: [] }
    if (report === 'tables') return { tableStats: [] }
    return { paymentBreakdown: EMPTY_PAYMENT_REPORT }
  }

  if (report === 'sales') {
    const [salesOverTime, heatmapData, topItems, paymentBreakdown] = await Promise.all([
      getSalesOverTime(restaurantId, range),
      getHeatmapData(restaurantId),
      getTopItems(restaurantId, range),
      getPaymentBreakdown(restaurantId, range),
    ])
    return { salesOverTime, heatmapData, topItems, paymentBreakdown }
  }

  if (report === 'items') {
    const productReport = await getProductReportData(restaurantId, range)
    return { productReport }
  }

  if (report === 'tables') {
    const tableStats = await getTablesReportData(restaurantId)
    return { tableStats }
  }

  const paymentBreakdown = await getPaymentBreakdown(restaurantId, range)
  return { paymentBreakdown }
}
