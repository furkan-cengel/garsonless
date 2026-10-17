import type {
  AbnormalCloseReport,
  CancellationReport,
  DailySale,
  HeatmapCell,
  LoyaltyReport,
  PaymentReport,
  ProductReportItem,
  StaffSettlementReport,
  TableReportRow,
  TopItem,
  AnalyticsRangeKPIs,
} from '../../lib/queries/analytics'
import type { AnalyticsReportId } from '../../lib/actions/analytics'
import { coerceAnalyticsQuery, type AnalyticsQuery, type AnalyticsRange } from '../../lib/analytics-filter-contract'
export type { AnalyticsQuery, AnalyticsRange } from '../../lib/analytics-filter-contract'

export const ANALYTICS_RANGES: ReadonlyArray<{ id: AnalyticsRange; label: string }> = [
  { id: 'day', label: 'Bugün' },
  { id: 'yesterday', label: 'Dün' },
  { id: 'week', label: '7G' },
  { id: 'month', label: '30G' },
  { id: 'calendar_month', label: 'Bu ay' },
  { id: 'quarter', label: '90G' },
  { id: 'year', label: 'Yıl' },
  { id: 'custom', label: 'Özel' },
]

export const ANALYTICS_REPORTS: ReadonlyArray<{
  id: AnalyticsReportId
  label: string
  desc: string
  badge?: string
  ownerOnly?: boolean
  requiresAdvancedAnalytics?: boolean
}> = [
  { id: 'sales', label: 'Satışlar', desc: 'Tahsilat & hacim' },
  { id: 'items', label: 'Ürünler', desc: 'Ürün performansı' },
  { id: 'tables', label: 'Masalar', desc: 'Devir & tahsilat' },
  { id: 'payments', label: 'Ödemeler', desc: 'Yöntem dağılımı' },
  { id: 'operasyon', label: 'Operasyon', desc: 'İptal · kaçak · tahsilat', badge: 'Pro', ownerOnly: true, requiresAdvancedAnalytics: true },
  { id: 'sadakat', label: 'Sadakat', desc: 'Puan · damga · ziyaret', badge: 'Pro', requiresAdvancedAnalytics: true },
]

export type AnalyticsData = {
  liveActiveOrders: number
  rangeKpis: AnalyticsRangeKPIs
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  tableStats: TableReportRow[]
  topItems: TopItem[]
  paymentBreakdown: PaymentReport
  productReport: ProductReportItem[]
  cancellations: CancellationReport | null
  abnormalCloses: AbnormalCloseReport | null
  staffSettlement: StaffSettlementReport | null
  loyalty: LoyaltyReport | null
}

export type AnalyticsInitialData = Pick<
  AnalyticsData,
  'rangeKpis' | 'salesOverTime' | 'heatmapData' | 'tableStats' | 'topItems' | 'paymentBreakdown' | 'productReport'
> & { liveActiveOrders?: number }

export type LoadedAnalyticsReports = Record<AnalyticsReportId, boolean>
export type AnalyticsFreshness = 'fresh' | 'refreshing' | 'stale' | 'offline'

export function createInitialAnalyticsData(initial: AnalyticsInitialData): AnalyticsData {
  return {
    ...initial,
    liveActiveOrders: initial.liveActiveOrders ?? 0,
    cancellations: null,
    abnormalCloses: null,
    staffSettlement: null,
    loyalty: null,
  }
}

export function createInitialLoadedReports(initial: AnalyticsInitialData): LoadedAnalyticsReports {
  return {
    sales: true,
    items: initial.productReport.length > 0,
    tables: initial.tableStats.length > 0,
    payments: true,
    operasyon: false,
    sadakat: false,
  }
}

export function createUnloadedReports(): LoadedAnalyticsReports {
  return {
    sales: false,
    items: false,
    tables: false,
    payments: false,
    operasyon: false,
    sadakat: false,
  }
}

export function markAnalyticsReportLoaded(
  reports: LoadedAnalyticsReports,
  report: AnalyticsReportId,
): LoadedAnalyticsReports {
  return {
    ...reports,
    [report]: true,
    ...(report === 'sales' ? { payments: true } : null),
  }
}

export function canExportAnalyticsReport(
  report: AnalyticsReportId,
  reports: LoadedAnalyticsReports,
  data: AnalyticsData,
): boolean {
  if (!reports[report]) return false
  if (report === 'operasyon') {
    return Boolean(data.cancellations && data.abnormalCloses && data.staffSettlement)
  }
  if (report === 'sadakat') return Boolean(data.loyalty)
  return true
}

/** What a locked advanced report would show, so the upgrade has a reason. */
export const LOCKED_REPORT_PREVIEWS: Partial<Record<AnalyticsReportId, string>> = {
  operasyon: 'İptal, ikram ve tahsil edilmeden kapanan adisyonları personele göre gösterir; kasa açığını erken yakalarsın.',
  sadakat: 'Seçili dönemdeki puan, damga ve ziyaret hareketlerini tek yerde gösterir.',
}

/** Advanced reports the viewer could see on a higher plan (never owner-only ones for staff). */
export function getLockedAnalyticsReports(isOwner: boolean, hasAdvancedAnalytics: boolean) {
  if (hasAdvancedAnalytics) return []
  return ANALYTICS_REPORTS.filter((report) => report.requiresAdvancedAnalytics && (!report.ownerOnly || isOwner))
}

export function getVisibleAnalyticsReports(isOwner: boolean, hasAdvancedAnalytics = true) {
  return ANALYTICS_REPORTS.filter((report) =>
    (!report.ownerOnly || isOwner) && (!report.requiresAdvancedAnalytics || hasAdvancedAnalytics),
  )
}

export function analyticsRangeLabel(range: string): string {
  return ANALYTICS_RANGES.find((candidate) => candidate.id === range)?.label ?? '7G'
}

export function analyticsRangePeriodLabel(input: string | AnalyticsQuery): string {
  const query = coerceAnalyticsQuery(input)
  if (query.range === 'custom' && query.from && query.to) {
    const format = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
    return `${format(query.from)} - ${format(query.to)}`
  }
  return ({
    day: 'Bugün',
    yesterday: 'Dün',
    week: 'Son 7 gün',
    month: 'Son 30 gün',
    calendar_month: 'Bu ay',
    quarter: 'Son 90 gün',
    year: 'Son 12 ay',
  } as Record<string, string>)[query.range] ?? 'Son 7 gün'
}

export function analyticsPreviousPeriodLabel(input: string | AnalyticsQuery): string {
  const range = coerceAnalyticsQuery(input).range
  return ({
    day: 'düne göre',
    yesterday: 'önceki güne göre',
    week: 'önceki haftaya göre',
    month: 'önceki 30 güne göre',
    calendar_month: 'önceki eş süreye göre',
    quarter: 'önceki 90 güne göre',
    year: 'geçen yıla göre',
    custom: 'önceki eş süreye göre',
  } as Record<string, string>)[range] ?? 'önceki döneme göre'
}

export function formatAnalyticsReportDate(value: string, timezone = 'Europe/Istanbul'): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

/**
 * Money reports count only payments recorded in Masabu (paid_at). When orders
 * exist without a recorded payment, say so instead of letting ₺0 look broken.
 */
export function unrecordedPaymentNotice(kpis: { orders: number; paidOrders: number; revenue: number }): { tone: 'warning' | 'info'; title: string; body: string } | null {
  const unpaid = Math.max(0, kpis.orders - kpis.paidOrders)
  if (unpaid === 0) return null
  // The gap also holds comp orders and bills paid outside the period, so name the reasons.
  const why = 'Ödemesi Masabu’da kaydedilmeyen (kasada veya harici POS’ta alınan), ikram edilen ya da başka dönemde ödenen siparişler tahsilata yansımaz. Ödemeleri Masalar’dan kaydedebilirsiniz.'
  if (kpis.revenue <= 0) {
    return { tone: 'warning', title: `${kpis.orders} sipariş var ama bu dönemde tahsilat kaydı yok`, body: `Bu yüzden tahsilat ve ürün raporları 0 görünüyor. ${why}` }
  }
  return { tone: 'info', title: `${unpaid} sipariş bu dönemin tahsilatına yansımadı`, body: why }
}
