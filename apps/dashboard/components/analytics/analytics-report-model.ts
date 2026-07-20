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
} from '../../lib/queries/analytics'
import type { AnalyticsReportId } from '../../lib/actions/analytics'

export type AnalyticsRange = 'day' | 'week' | 'month' | 'quarter' | 'year'

export const ANALYTICS_RANGES: ReadonlyArray<{ id: AnalyticsRange; label: string }> = [
  { id: 'day', label: 'Bugün' },
  { id: 'week', label: '7G' },
  { id: 'month', label: '30G' },
  { id: 'quarter', label: '90G' },
  { id: 'year', label: 'Yıl' },
]

export const ANALYTICS_REPORTS: ReadonlyArray<{
  id: AnalyticsReportId
  label: string
  desc: string
  badge?: string
  ownerOnly?: boolean
}> = [
  { id: 'sales', label: 'Satışlar', desc: 'Tahsilat & hacim' },
  { id: 'items', label: 'Ürünler', desc: 'Ürün performansı' },
  { id: 'tables', label: 'Masalar', desc: 'Devir & tahsilat' },
  { id: 'payments', label: 'Ödemeler', desc: 'Yöntem dağılımı' },
  { id: 'operasyon', label: 'Operasyon', desc: 'İptal · kaçak · tahsilat', badge: 'Yeni', ownerOnly: true },
  { id: 'sadakat', label: 'Sadakat', desc: 'Puan · damga · ziyaret', badge: 'Yeni' },
]

export type AnalyticsData = {
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
  'salesOverTime' | 'heatmapData' | 'tableStats' | 'topItems' | 'paymentBreakdown' | 'productReport'
>

export type LoadedAnalyticsReports = Record<AnalyticsReportId, boolean>

export function createInitialAnalyticsData(initial: AnalyticsInitialData): AnalyticsData {
  return {
    ...initial,
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

export function getVisibleAnalyticsReports(isOwner: boolean) {
  return ANALYTICS_REPORTS.filter((report) => !report.ownerOnly || isOwner)
}

export function analyticsRangeLabel(range: string): string {
  return ANALYTICS_RANGES.find((candidate) => candidate.id === range)?.label ?? '7G'
}

export function analyticsRangePeriodLabel(range: string): string {
  return ({
    day: 'Bugün',
    week: 'Son 7 gün',
    month: 'Son 30 gün',
    quarter: 'Son 90 gün',
    year: 'Son 12 ay',
  } as Record<string, string>)[range] ?? 'Son 7 gün'
}

export function analyticsPreviousPeriodLabel(range: string): string {
  return ({
    day: 'düne göre',
    week: 'önceki haftaya göre',
    month: 'önceki 30 güne göre',
    quarter: 'önceki 90 güne göre',
    year: 'geçen yıla göre',
  } as Record<string, string>)[range] ?? 'önceki döneme göre'
}

export function formatAnalyticsReportDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
