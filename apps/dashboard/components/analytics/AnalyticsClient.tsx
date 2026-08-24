'use client'

import dynamic from 'next/dynamic'
import type {
  AnalyticsRangeKPIs,
  TopItem,
  DailySale,
  HeatmapCell,
  TableReportRow,
  PaymentReport,
  ProductReportItem,
} from '../../lib/queries/analytics'
import { AnalyticsReportShell } from './AnalyticsReportShell'
import { useAnalyticsReports } from './use-analytics-reports'
import type { AnalyticsQuery } from '../../lib/analytics-filter-contract'
import type { AnalyticsReportId } from '../../lib/actions/analytics'
import {
  loadAnalyticsItemsReport,
  loadAnalyticsLoyaltyReport,
  loadAnalyticsOperationsReport,
  loadAnalyticsPaymentsReport,
  loadAnalyticsSalesReport,
  loadAnalyticsTablesReport,
  preloadAnalyticsReport,
} from './analytics-report-loaders'
const AnalyticsSalesReport = dynamic(loadAnalyticsSalesReport)
const AnalyticsPaymentsReport = dynamic(loadAnalyticsPaymentsReport)
const AnalyticsItemsReport = dynamic(loadAnalyticsItemsReport)
const AnalyticsTablesReport = dynamic(loadAnalyticsTablesReport)
const AnalyticsOperationsReport = dynamic(loadAnalyticsOperationsReport)
const AnalyticsLoyaltyReport = dynamic(loadAnalyticsLoyaltyReport)
interface Props {
  restaurantId: string
  restaurantName: string
  rangeKpis: AnalyticsRangeKPIs
  liveActiveOrders: number
  topItems: TopItem[]
  salesOverTime: DailySale[]
  heatmapData: HeatmapCell[]
  tableStats: TableReportRow[]
  paymentBreakdown: PaymentReport
  productReport: ProductReportItem[]
  /** Operasyon is an owner-only AUDIT tab (staff emails + cash audit + fraud
      flags) — hidden from members; the queries re-check server-side anyway. */
  isOwner: boolean
  /** Pro/Business only. The action layer checks this again before data reads. */
  hasAdvancedAnalytics: boolean
  initialQuery: AnalyticsQuery
  initialReport: AnalyticsReportId
  initialGeneratedAt: string
  initialSnapshotVersion: number
}

export default function AnalyticsClient({
  restaurantId,
  restaurantName,
  rangeKpis,
  liveActiveOrders,
  topItems,
  salesOverTime,
  heatmapData,
  tableStats,
  paymentBreakdown,
  productReport,
  isOwner,
  hasAdvancedAnalytics,
  initialQuery,
  initialReport,
  initialGeneratedAt,
  initialSnapshotVersion,
}: Props) {
  const reports = useAnalyticsReports({
    restaurantId,
    isOwner,
    hasAdvancedAnalytics,
    initialQuery,
    initialReport,
    initialGeneratedAt,
    initialSnapshotVersion,
    initialData: {
      salesOverTime,
      rangeKpis,
      heatmapData,
      tableStats,
      topItems,
      paymentBreakdown,
      productReport,
    },
  })

  async function handleExport() {
    if (!reports.canExport) return
    const { buildAnalyticsReportCsv, downloadAnalyticsCsv } = await import('./analytics-report-export')
    const built = buildAnalyticsReportCsv(reports.activeReport, reports.query, reports.analyticsData)
    if (!built) return
    downloadAnalyticsCsv(built.filename, built.csv)
  }

  return (
    <AnalyticsReportShell
      restaurantName={restaurantName}
      activeReport={reports.activeReport}
      range={reports.range}
      query={reports.query}
      isOwner={isOwner}
      hasAdvancedAnalytics={hasAdvancedAnalytics}
      isPending={reports.isPending}
      activeReportLoaded={reports.activeReportLoaded}
      canExport={reports.canExport}
      loadError={reports.loadError}
      generatedAt={reports.generatedAt}
      freshness={reports.freshness}
      onReportChange={(report) => {
        preloadAnalyticsReport(report)
        reports.changeReport(report)
      }}
      onReportIntent={preloadAnalyticsReport}
      onRangeChange={reports.changeRange}
      onQueryChange={reports.changeQuery}
      onRetry={reports.retry}
      onRefresh={reports.refresh}
      onExport={() => { void handleExport() }}
    >
      {reports.activeReport === 'sales' && reports.activeReportLoaded && (
        <AnalyticsSalesReport
          rangeKpis={reports.analyticsData.rangeKpis}
          liveActiveOrders={liveActiveOrders}
          topItems={reports.analyticsData.topItems}
          salesOverTime={reports.analyticsData.salesOverTime}
          heatmapData={reports.analyticsData.heatmapData}
          paymentBreakdown={reports.analyticsData.paymentBreakdown}
          query={reports.query}
        />
      )}
      {reports.activeReport === 'items' && reports.activeReportLoaded && <AnalyticsItemsReport items={reports.analyticsData.productReport} query={reports.query} />}
      {reports.activeReport === 'tables' && reports.activeReportLoaded && <AnalyticsTablesReport tables={reports.analyticsData.tableStats} query={reports.query} />}
      {reports.activeReport === 'payments' && reports.activeReportLoaded && <AnalyticsPaymentsReport paymentBreakdown={reports.analyticsData.paymentBreakdown} query={reports.query} />}
      {reports.activeReport === 'operasyon' && reports.activeReportLoaded && reports.analyticsData.cancellations && reports.analyticsData.abnormalCloses && reports.analyticsData.staffSettlement && (
        <AnalyticsOperationsReport
          cancellations={reports.analyticsData.cancellations}
          abnormalCloses={reports.analyticsData.abnormalCloses}
          staffSettlement={reports.analyticsData.staffSettlement}
          query={reports.query}
        />
      )}
      {reports.activeReport === 'sadakat' && reports.activeReportLoaded && reports.analyticsData.loyalty && (
        <AnalyticsLoyaltyReport loyalty={reports.analyticsData.loyalty} query={reports.query} />
      )}
    </AnalyticsReportShell>
  )
}
