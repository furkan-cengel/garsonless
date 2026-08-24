'use server'

import {
  getAnalyticsSalesReportData,
  getTablesReportData,
  getPaymentBreakdown,
  getProductReportData,
  getCancellationReport,
  getAbnormalCloseReport,
  getStaffSettlementReport,
  getLoyaltyReport,
} from '../queries/analytics'
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
  AnalyticsRangeKPIs,
} from '../queries/analytics'
import { assertAccess } from '../auth/access'
import { createDashboardServerClient } from '../supabase-server'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import { validateAnalyticsQuery } from '../analytics-filter-contract'

export interface AnalyticsPayload {
  rangeKpis: AnalyticsRangeKPIs
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
export type AnalyticsReportErrorCode = 'INVALID_REQUEST' | 'FORBIDDEN' | 'FEATURE_LOCKED' | 'LOAD_FAILED'
export interface AnalyticsReportResponse<T = Partial<AnalyticsPayload>> {
  data?: T
  generatedAt: string
  snapshotVersion: number
  error?: string
  errorCode?: AnalyticsReportErrorCode
}
const REPORT_IDS: AnalyticsReportId[] = ['sales', 'items', 'tables', 'payments', 'operasyon', 'sadakat']
const ADVANCED_REPORTS: ReadonlySet<AnalyticsReportId> = new Set(['operasyon', 'sadakat'])

function validReport(report: string): report is AnalyticsReportId {
  return (REPORT_IDS as string[]).includes(report)
}

/**
 * Package checks stay at the authenticated server-action boundary. The UI
 * merely hides unavailable reports; a replayed action must not obtain them.
 */
async function hasAdvancedAnalyticsEntitlement(restaurantId: string): Promise<boolean> {
  const supabase = await createDashboardServerClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('plan')
    .eq('id', restaurantId)
    .maybeSingle()
  if (!restaurant) return false
  return canRestaurantUseFeature({
    restaurantId,
    plan: (restaurant as { plan?: unknown }).plan,
    feature: 'analytics_advanced',
  })
}

export async function fetchAnalyticsReportData(
  restaurantId: string,
  queryInput: unknown,
  report: AnalyticsReportId,
): Promise<AnalyticsReportResponse> {
  const requestedAt = new Date()
  const fail = (errorCode: AnalyticsReportErrorCode, error: string): AnalyticsReportResponse => ({
    generatedAt: requestedAt.toISOString(),
    snapshotVersion: requestedAt.getTime(),
    errorCode,
    error,
  })
  const succeed = (data: Partial<AnalyticsPayload>, generatedAt: Date): AnalyticsReportResponse => ({
    data,
    generatedAt: generatedAt.toISOString(),
    snapshotVersion: generatedAt.getTime(),
  })
  const query = validateAnalyticsQuery(queryInput)
  if (!query || !validReport(report)) return fail('INVALID_REQUEST', 'Geçersiz rapor isteği')
  // Owner OR a member with 'analytics'. Denied → empty payload (no data).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return fail('FORBIDDEN', gate.error)
  if (ADVANCED_REPORTS.has(report) && !(await hasAdvancedAnalyticsEntitlement(restaurantId))) {
    return fail('FEATURE_LOCKED', 'Gelişmiş raporlar Pro paketiyle kullanılabilir.')
  }

  try {
    const asOf = new Date()
    if (report === 'sales') {
      return succeed(await getAnalyticsSalesReportData(restaurantId, query, asOf), asOf)
    }

    if (report === 'items') {
      const productReport = await getProductReportData(restaurantId, query, asOf)
      return succeed({ productReport }, asOf)
    }

    if (report === 'tables') {
      const tableStats = await getTablesReportData(restaurantId, query, asOf)
      return succeed({ tableStats }, asOf)
    }

    if (report === 'operasyon') {
      const [cancellations, abnormalCloses, staffSettlement] = await Promise.all([
        getCancellationReport(restaurantId, query, asOf),
        getAbnormalCloseReport(restaurantId, query, asOf),
        getStaffSettlementReport(restaurantId, query, asOf),
      ])
      return succeed({ cancellations, abnormalCloses, staffSettlement }, asOf)
    }

    if (report === 'sadakat') {
      // İkram ₺ reuses getPaymentBreakdown's comp — the Sadakat and Ödemeler tabs
      // must show the same number for the same range.
      const dateOnlyQuery = { ...query, filters: { source: 'all' as const, paymentMethod: 'all' as const, status: 'all' as const } }
      const [loyaltyRaw, paymentBreakdown] = await Promise.all([
        getLoyaltyReport(restaurantId, dateOnlyQuery, asOf),
        getPaymentBreakdown(restaurantId, dateOnlyQuery, asOf),
      ])
      return succeed({ loyalty: { ...loyaltyRaw, comp: paymentBreakdown.comp } }, asOf)
    }

    const paymentBreakdown = await getPaymentBreakdown(restaurantId, query, asOf)
    return succeed({ paymentBreakdown }, asOf)
  } catch {
    return fail('LOAD_FAILED', 'Rapor verileri yüklenemedi. Lütfen tekrar deneyin.')
  }
}
