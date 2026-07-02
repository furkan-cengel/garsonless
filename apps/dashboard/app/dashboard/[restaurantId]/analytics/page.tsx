import { notFound } from 'next/navigation'
import {
  getRestaurantById,
  getDashboardKPIs,
  getTopItems,
  getSalesOverTime,
  getHeatmapData,
  getPaymentBreakdown,
} from '../../../../lib/queries'
import AnalyticsClient from '../../../../components/analytics/AnalyticsClient'
import { requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function AnalyticsPage({ params }: Props) {
  const { restaurantId } = await params
  // Members with 'analytics' see the business tabs; the Operasyon AUDIT tab
  // (staff emails + per-person cash + fraud flags) is owner-only — the nav is
  // filtered by isOwner and the queries themselves re-check server-side.
  const access = await requireSection(restaurantId, 'analytics')
  const [restaurant, kpis, topItems, salesOverTime, heatmapData, paymentBreakdown] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardKPIs(restaurantId),
    getTopItems(restaurantId, 'week'),
    getSalesOverTime(restaurantId, 'week'),
    getHeatmapData(restaurantId),
    getPaymentBreakdown(restaurantId, 'week'),
  ])
  if (!restaurant) notFound()

  return (
    <AnalyticsClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      kpis={kpis}
      topItems={topItems}
      salesOverTime={salesOverTime}
      heatmapData={heatmapData}
      tableStats={[]}
      paymentBreakdown={paymentBreakdown}
      productReport={[]}
      isOwner={access.isOwner}
    />
  )
}
