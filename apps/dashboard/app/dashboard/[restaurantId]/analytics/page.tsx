import { getRestaurantTimezone, rangeWindowFor } from '../../../../lib/queries/insights-shared'
import { analyticsDateError } from '../../../../lib/analytics-report-scope'
import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import {
  getAnalyticsSalesReportData,
} from '../../../../lib/queries/analytics'
import AnalyticsClient from '../../../../components/analytics/AnalyticsClientBoundary'
import { requireSection } from '../../../../lib/auth/access'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import { parseAnalyticsQuery } from '../../../../lib/analytics-filter-contract'
import type { AnalyticsReportId } from '../../../../lib/actions/analytics'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'
import { readBillingPlanPrices } from '../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const [{ restaurantId }, requestedParams] = await Promise.all([params, searchParams])
  let initialQuery = parseAnalyticsQuery(requestedParams)
  // Members with 'analytics' see the business tabs; the Operasyon AUDIT tab
  // (staff emails + per-person cash + fraud flags) is owner-only — the nav is
  // filtered by isOwner and the queries themselves re-check server-side.
  const access = await requireSection(restaurantId, 'analytics')
  const asOf = new Date()
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'analytics_basic' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="analytics_basic" isOwner={access.isOwner} planPrices={readBillingPlanPrices()} />
  }
  const timezone = await getRestaurantTimezone(restaurantId)
  if (analyticsDateError(initialQuery, timezone, asOf)) initialQuery = parseAnalyticsQuery({})
  const [salesReport, window] = await Promise.all([
    getAnalyticsSalesReportData(restaurantId, initialQuery, asOf),
    rangeWindowFor(restaurantId, initialQuery, asOf),
  ])
  const initialScope = { timezone, currentStart: window.currentStart.toISOString(), currentEnd: window.currentEnd.toISOString(),
    previousStart: window.previousStart.toISOString(), previousEnd: window.currentStart.toISOString() }
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
      key={restaurantId}
      initialScope={initialScope}
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      liveActiveOrders={salesReport.liveActiveOrders}
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
      initialGeneratedAt={asOf.toISOString()}
    />
  )
}
