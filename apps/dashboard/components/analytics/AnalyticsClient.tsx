'use client'

import dynamic from 'next/dynamic'
import { useAnalyticsExport } from './use-analytics-export'
import type { AnalyticsReportScope } from '../../lib/analytics-report-scope'
import type {
  AnalyticsRangeKPIs,
  TopItem,
  DailySale,
  HeatmapCell,
  TableReportRow,
  PaymentReport,
  ProductReportItem,
} from '../../lib/queries/analytics'
import { AnalyticsReportLoading } from './AnalyticsReportLoading'
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
const AnalyticsSalesReport = dynamic(loadAnalyticsSalesReport, { loading: () => <AnalyticsReportLoading report="sales" /> })
const AnalyticsPaymentsReport = dynamic(loadAnalyticsPaymentsReport, { loading: () => <AnalyticsReportLoading report="payments" /> })
const AnalyticsItemsReport = dynamic(loadAnalyticsItemsReport, { loading: () => <AnalyticsReportLoading report="items" /> })
const AnalyticsTablesReport = dynamic(loadAnalyticsTablesReport, { loading: () => <AnalyticsReportLoading report="tables" /> })
const AnalyticsOperationsReport = dynamic(loadAnalyticsOperationsReport, { loading: () => <AnalyticsReportLoading report="operasyon" /> })
const AnalyticsLoyaltyReport = dynamic(loadAnalyticsLoyaltyReport, { loading: () => <AnalyticsReportLoading report="sadakat" /> })
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
  initialScope: AnalyticsReportScope
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
  initialScope,
}: Props) {
  const reports = useAnalyticsReports({
    restaurantId,
    isOwner,
    hasAdvancedAnalytics,
    initialQuery,
    initialReport,
    initialGeneratedAt,
    initialScope,
    initialData: {
      liveActiveOrders,
      salesOverTime,
      rangeKpis,
      heatmapData,
      tableStats,
      topItems,
      paymentBreakdown,
      productReport,
    },
  })

  const { handleExport, isExporting, exportError } = useAnalyticsExport({ reports, restaurantId, restaurantName })

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
      canExport={reports.canExport && !isExporting}
      isExporting={isExporting}
      exportError={exportError}
      timezone={initialScope.timezone}
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
          liveActiveOrders={reports.analyticsData.liveActiveOrders}
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
