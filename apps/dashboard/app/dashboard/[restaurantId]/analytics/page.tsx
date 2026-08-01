import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import {
  getDashboardKPIs,
  getAnalyticsSalesReportData,
} from '../../../../lib/queries/analytics'
import AnalyticsClient from '../../../../components/analytics/AnalyticsClient'
import { requireSection } from '../../../../lib/auth/access'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import { parseAnalyticsQuery } from '../../../../lib/analytics-filter-contract'
import type { AnalyticsReportId } from '../../../../lib/actions/analytics'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const [{ restaurantId }, requestedParams] = await Promise.all([params, searchParams])
  const initialQuery = parseAnalyticsQuery(requestedParams)
  // Members with 'analytics' see the business tabs; the Operasyon AUDIT tab
  // (staff emails + per-person cash + fraud flags) is owner-only — the nav is
  // filtered by isOwner and the queries themselves re-check server-side.
  const access = await requireSection(restaurantId, 'analytics')
  const asOf = new Date()
  const [restaurant, liveKpis, salesReport] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardKPIs(restaurantId),
    getAnalyticsSalesReportData(restaurantId, initialQuery, asOf),
  ])
  if (!restaurant) notFound()
  const hasAdvancedAnalytics = await canRestaurantUseFeature({
    restaurantId,
    plan: restaurant.plan,
    feature: 'analytics_advanced',
  })
  const requestedReport = typeof requestedParams['report'] === 'string' ? requestedParams['report'] : 'sales'
  const initialReport: AnalyticsReportId = (
    ['sales', 'items', 'tables', 'payments', 'operasyon', 'sadakat'].includes(requestedReport)
    && (requestedReport !== 'operasyon' || access.isOwner)
    && ((requestedReport !== 'operasyon' && requestedReport !== 'sadakat') || hasAdvancedAnalytics)
  ) ? requestedReport as AnalyticsReportId : 'sales'

  return (
    <AnalyticsClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      liveActiveOrders={liveKpis.activeOrders}
      rangeKpis={salesReport.rangeKpis}
      topItems={salesReport.topItems}
      salesOverTime={salesReport.salesOverTime}
      heatmapData={salesReport.heatmapData}
      tableStats={[]}
      paymentBreakdown={salesReport.paymentBreakdown}
      productReport={[]}
      isOwner={access.isOwner}
      hasAdvancedAnalytics={hasAdvancedAnalytics}
      initialQuery={initialQuery}
      initialReport={initialReport}
    />
  )
}
