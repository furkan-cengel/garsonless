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
    return `${format(query.from)} – ${format(query.to)}`
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
