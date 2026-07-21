'use client'

import type {
  DashboardKPIs,
  TopItem,
  DailySale,
  HeatmapCell,
  TableReportRow,
  PaymentReport,
  ProductReportItem,
} from '../../lib/queries/analytics'
import { AnalyticsItemsReport } from './AnalyticsItemsReport'
import { AnalyticsLoyaltyReport } from './AnalyticsLoyaltyReport'
import { AnalyticsOperationsReport } from './AnalyticsOperationsReport'
import { AnalyticsReportShell } from './AnalyticsReportShell'
import { AnalyticsPaymentsReport, AnalyticsSalesReport } from './AnalyticsSalesPaymentReports'
import { AnalyticsTablesReport } from './AnalyticsTablesReport'
import { buildAnalyticsReportCsv, downloadAnalyticsCsv } from './analytics-report-export'
import { useAnalyticsReports } from './use-analytics-reports'

interface Props {
  restaurantId: string
  restaurantName: string
  kpis: DashboardKPIs
  topItems: TopItem[]
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  tableStats: TableReportRow[]
  paymentBreakdown: PaymentReport
  productReport: ProductReportItem[]
  /** Operasyon is an owner-only AUDIT tab (staff emails + cash audit + fraud
      flags) — hidden from members; the queries re-check server-side anyway. */
  isOwner: boolean
  /** Pro/Enterprise only. The action layer checks this again before data reads. */
  hasAdvancedAnalytics: boolean
}

export default function AnalyticsClient({
  restaurantId,
  restaurantName,
  kpis,
  topItems,
  salesOverTime,
  heatmapData,
  tableStats,
  paymentBreakdown,
  productReport,
  isOwner,
  hasAdvancedAnalytics,
}: Props) {
  const reports = useAnalyticsReports({
    restaurantId,
    isOwner,
    hasAdvancedAnalytics,
    initialData: {
      salesOverTime,
      heatmapData,
      tableStats,
      topItems,
      paymentBreakdown,
      productReport,
    },
  })

  function handleExport() {
    if (!reports.canExport) return
    const built = buildAnalyticsReportCsv(reports.activeReport, reports.range, kpis, reports.analyticsData)
    if (!built) return
    downloadAnalyticsCsv(built.filename, built.csv)
  }

  return (
    <AnalyticsReportShell
      restaurantName={restaurantName}
      activeReport={reports.activeReport}
      range={reports.range}
      isOwner={isOwner}
      hasAdvancedAnalytics={hasAdvancedAnalytics}
      isPending={reports.isPending}
      activeReportLoaded={reports.activeReportLoaded}
      canExport={reports.canExport}
      loadError={reports.loadError}
      onReportChange={reports.changeReport}
      onRangeChange={reports.changeRange}
      onRetry={reports.retry}
      onExport={handleExport}
    >
      {reports.activeReport === 'sales' && reports.activeReportLoaded && (
        <AnalyticsSalesReport
          kpis={kpis}
          topItems={reports.analyticsData.topItems}
          salesOverTime={reports.analyticsData.salesOverTime}
          heatmapData={reports.analyticsData.heatmapData}
          paymentBreakdown={reports.analyticsData.paymentBreakdown}
          range={reports.range}
        />
      )}
      {reports.activeReport === 'items' && reports.activeReportLoaded && <AnalyticsItemsReport items={reports.analyticsData.productReport} range={reports.range} />}
      {reports.activeReport === 'tables' && reports.activeReportLoaded && <AnalyticsTablesReport tables={reports.analyticsData.tableStats} range={reports.range} />}
      {reports.activeReport === 'payments' && reports.activeReportLoaded && <AnalyticsPaymentsReport paymentBreakdown={reports.analyticsData.paymentBreakdown} range={reports.range} />}
      {reports.activeReport === 'operasyon' && reports.activeReportLoaded && reports.analyticsData.cancellations && reports.analyticsData.abnormalCloses && reports.analyticsData.staffSettlement && (
        <AnalyticsOperationsReport
          cancellations={reports.analyticsData.cancellations}
          abnormalCloses={reports.analyticsData.abnormalCloses}
          staffSettlement={reports.analyticsData.staffSettlement}
          range={reports.range}
        />
      )}
      {reports.activeReport === 'sadakat' && reports.activeReportLoaded && reports.analyticsData.loyalty && (
        <AnalyticsLoyaltyReport loyalty={reports.analyticsData.loyalty} range={reports.range} />
      )}
    </AnalyticsReportShell>
  )
}
