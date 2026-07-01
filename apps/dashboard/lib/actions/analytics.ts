'use server'

import {
  getSalesOverTime,
  getHeatmapData,
  getTablesReportData,
  getTopItems,
  getPaymentBreakdown,
  getProductReportData,
  getCancellationReport,
  getAbnormalCloseReport,
  getStaffSettlementReport,
} from '../queries'
import type {
  DailySale,
  HeatmapCell,
  TableReportRow,
  TopItem,
  PaymentReport,
  ProductReportItem,
  CancellationReport,
  AbnormalCloseReport,
  StaffSettlementReport,
} from '../queries'
import { assertAccess } from '../auth/access'

const EMPTY_CANCELLATIONS: CancellationReport = { count: 0, lostAmount: 0, allOrders: 0, rate: 0, topItems: [], trend: [], deltaCount: 0, deltaLost: 0, deltaRate: 0 }
const EMPTY_ABNORMAL: AbnormalCloseReport = { count: 0, unpaidTotal: 0, rows: [], deltaCount: 0, deltaUnpaid: 0 }
const EMPTY_STAFF: StaffSettlementReport = { rows: [], totalCollected: 0 }

const EMPTY_ANALYTICS: AnalyticsPayload = {
  salesOverTime: [], heatmapData: [], tableStats: [], topItems: [],
  paymentBreakdown: { collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0 },
  productReport: [],
  cancellations: EMPTY_CANCELLATIONS, abnormalCloses: EMPTY_ABNORMAL, staffSettlement: EMPTY_STAFF,
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
  cancellations: CancellationReport
  abnormalCloses: AbnormalCloseReport
  staffSettlement: StaffSettlementReport
}

export type AnalyticsReportId = 'sales' | 'items' | 'tables' | 'payments' | 'operasyon'

export async function fetchAnalyticsData(restaurantId: string, range: string): Promise<AnalyticsPayload> {
  // Owner OR a member with 'analytics'. Denied → empty payload (no data).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return EMPTY_ANALYTICS

  const [salesOverTime, heatmapData, tableStats, topItems, paymentBreakdown, productReport, cancellations, abnormalCloses, staffSettlement] = await Promise.all([
    getSalesOverTime(restaurantId, range),
    getHeatmapData(restaurantId),
    getTablesReportData(restaurantId),
    getTopItems(restaurantId, range),
    getPaymentBreakdown(restaurantId, range),
    getProductReportData(restaurantId, range),
    getCancellationReport(restaurantId, range),
    getAbnormalCloseReport(restaurantId, range),
    getStaffSettlementReport(restaurantId, range),
  ])
  return { salesOverTime, heatmapData, tableStats, topItems, paymentBreakdown, productReport, cancellations, abnormalCloses, staffSettlement }
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
    if (report === 'operasyon') {
      return {
        cancellations: EMPTY_CANCELLATIONS,
        abnormalCloses: EMPTY_ABNORMAL,
        staffSettlement: EMPTY_STAFF,
      }
    }
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

  if (report === 'operasyon') {
    const [cancellations, abnormalCloses, staffSettlement] = await Promise.all([
      getCancellationReport(restaurantId, range),
      getAbnormalCloseReport(restaurantId, range),
      getStaffSettlementReport(restaurantId, range),
    ])
    return { cancellations, abnormalCloses, staffSettlement }
  }

  const paymentBreakdown = await getPaymentBreakdown(restaurantId, range)
  return { paymentBreakdown }
}
