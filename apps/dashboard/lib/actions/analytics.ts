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
  getLoyaltyReport,
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
  LoyaltyReport,
} from '../queries'
import { assertAccess } from '../auth/access'

const EMPTY_CANCELLATIONS: CancellationReport = { count: 0, lostAmount: 0, allOrders: 0, rate: 0, topItems: [], trend: [], deltaCount: 0, deltaLost: 0, deltaRate: 0 }
const EMPTY_ABNORMAL: AbnormalCloseReport = { count: 0, unpaidTotal: 0, rows: [], deltaCount: 0, deltaUnpaid: 0 }
const EMPTY_STAFF: StaffSettlementReport = { rows: [], totalCollected: 0 }
const EMPTY_LOYALTY: LoyaltyReport = {
  pointsIssued: 0, pointsRedeemed: 0, redeemRate: 0, pointsRefunded: 0,
  stampsIssued: 0, stampsRedeemed: 0, stampsRefunded: 0,
  visits: 0, welcomeCount: 0, welcomePoints: 0,
  redemptionsByReason: [], comp: { amount: 0, count: 0 },
}

const EMPTY_ANALYTICS: AnalyticsPayload = {
  salesOverTime: [], heatmapData: [], tableStats: [], topItems: [],
  paymentBreakdown: { collected: [], comp: { amount: 0, count: 0 }, collectedTotal: 0, collectedCount: 0 },
  productReport: [],
  cancellations: EMPTY_CANCELLATIONS, abnormalCloses: EMPTY_ABNORMAL, staffSettlement: EMPTY_STAFF,
  loyalty: EMPTY_LOYALTY,
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
  loyalty: LoyaltyReport
}

export type AnalyticsReportId = 'sales' | 'items' | 'tables' | 'payments' | 'operasyon' | 'sadakat'
const REPORT_IDS: AnalyticsReportId[] = ['sales', 'items', 'tables', 'payments', 'operasyon', 'sadakat']
const RANGES = ['day', 'week', 'month', 'quarter', 'year'] as const

function validRange(range: string): range is typeof RANGES[number] {
  return (RANGES as readonly string[]).includes(range)
}

function validReport(report: string): report is AnalyticsReportId {
  return (REPORT_IDS as string[]).includes(report)
}

export async function fetchAnalyticsData(restaurantId: string, range: string): Promise<AnalyticsPayload> {
  // Owner OR a member with 'analytics'. Denied → empty payload (no data).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return EMPTY_ANALYTICS

  const [salesOverTime, heatmapData, tableStats, topItems, paymentBreakdown, productReport, cancellations, abnormalCloses, staffSettlement, loyaltyRaw] = await Promise.all([
    getSalesOverTime(restaurantId, range),
    getHeatmapData(restaurantId),
    getTablesReportData(restaurantId, range),
    getTopItems(restaurantId, range),
    getPaymentBreakdown(restaurantId, range),
    getProductReportData(restaurantId, range),
    getCancellationReport(restaurantId, range),
    getAbnormalCloseReport(restaurantId, range),
    getStaffSettlementReport(restaurantId, range),
    getLoyaltyReport(restaurantId, range),
  ])
  // İkram ₺ on the Sadakat tab = the SAME comp figure the Ödemeler tab shows.
  const loyalty = { ...loyaltyRaw, comp: paymentBreakdown.comp }
  return { salesOverTime, heatmapData, tableStats, topItems, paymentBreakdown, productReport, cancellations, abnormalCloses, staffSettlement, loyalty }
}

export async function fetchAnalyticsReportData(
  restaurantId: string,
  range: string,
  report: AnalyticsReportId,
): Promise<Partial<AnalyticsPayload> & { error?: string }> {
  if (!validRange(range) || !validReport(report)) return { error: 'Geçersiz rapor isteği' }
  // Owner OR a member with 'analytics'. Denied → empty payload (no data).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return { error: gate.error }

  try {
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
      const tableStats = await getTablesReportData(restaurantId, range)
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

    if (report === 'sadakat') {
      // İkram ₺ reuses getPaymentBreakdown's comp — the Sadakat and Ödemeler tabs
      // must show the same number for the same range.
      const [loyaltyRaw, paymentBreakdown] = await Promise.all([
        getLoyaltyReport(restaurantId, range),
        getPaymentBreakdown(restaurantId, range),
      ])
      return { loyalty: { ...loyaltyRaw, comp: paymentBreakdown.comp } }
    }

    const paymentBreakdown = await getPaymentBreakdown(restaurantId, range)
    return { paymentBreakdown }
  } catch {
    return { error: 'Rapor verileri yüklenemedi. Lütfen tekrar deneyin.' }
  }
}
