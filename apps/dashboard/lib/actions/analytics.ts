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
): Promise<Partial<AnalyticsPayload> & { error?: string }> {
  const query = validateAnalyticsQuery(queryInput)
  if (!query || !validReport(report)) return { error: 'Geçersiz rapor isteği' }
  // Owner OR a member with 'analytics'. Denied → empty payload (no data).
  const gate = await assertAccess(restaurantId, 'analytics')
  if ('error' in gate) return { error: gate.error }
  if (ADVANCED_REPORTS.has(report) && !(await hasAdvancedAnalyticsEntitlement(restaurantId))) {
    return { error: 'Gelişmiş raporlar Pro paketiyle kullanılabilir.' }
  }

  try {
    const asOf = new Date()
    if (report === 'sales') {
      return getAnalyticsSalesReportData(restaurantId, query, asOf)
    }

    if (report === 'items') {
      const productReport = await getProductReportData(restaurantId, query, asOf)
      return { productReport }
    }

    if (report === 'tables') {
      const tableStats = await getTablesReportData(restaurantId, query, asOf)
      return { tableStats }
    }

    if (report === 'operasyon') {
      const [cancellations, abnormalCloses, staffSettlement] = await Promise.all([
        getCancellationReport(restaurantId, query, asOf),
        getAbnormalCloseReport(restaurantId, query, asOf),
        getStaffSettlementReport(restaurantId, query, asOf),
      ])
      return { cancellations, abnormalCloses, staffSettlement }
    }

    if (report === 'sadakat') {
      // İkram ₺ reuses getPaymentBreakdown's comp — the Sadakat and Ödemeler tabs
      // must show the same number for the same range.
      const dateOnlyQuery = { ...query, filters: { source: 'all' as const, paymentMethod: 'all' as const, status: 'all' as const } }
      const [loyaltyRaw, paymentBreakdown] = await Promise.all([
        getLoyaltyReport(restaurantId, dateOnlyQuery, asOf),
        getPaymentBreakdown(restaurantId, dateOnlyQuery, asOf),
      ])
      return { loyalty: { ...loyaltyRaw, comp: paymentBreakdown.comp } }
    }

    const paymentBreakdown = await getPaymentBreakdown(restaurantId, query, asOf)
    return { paymentBreakdown }
  } catch {
    return { error: 'Rapor verileri yüklenemedi. Lütfen tekrar deneyin.' }
  }
}
