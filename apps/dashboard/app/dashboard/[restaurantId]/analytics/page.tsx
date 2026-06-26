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
  await requireSection(restaurantId, 'analytics')
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
    />
  )
}
