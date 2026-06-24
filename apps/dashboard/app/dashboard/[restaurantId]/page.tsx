import { notFound } from 'next/navigation'
import {
  getRestaurantById,
  getDashboardKPIs,
  getHourlySales,
  getActivityFeed,
  getTopItems,
  getTableStatuses,
  getHeatmapData,
  getPaymentStatus,
  type PaymentStatus,
} from '../../../lib/queries'
import PanoClient from '../../../components/pano/PanoClient'
import { requireSection } from '../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function PanoPage({ params }: Props) {
  const { restaurantId } = await params
  // Pano requires its own perm; members without it land on their first section.
  const access = await requireSection(restaurantId, 'pano')
  const isOwner = access.isOwner

  const [restaurant, kpis, hourlySales, initialFeed, topItems, tableStatuses, heatmap, paymentStatus] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardKPIs(restaurantId),
    getHourlySales(restaurantId),
    getActivityFeed(restaurantId),
    getTopItems(restaurantId),
    getTableStatuses(restaurantId),
    getHeatmapData(restaurantId),
    // Payment config is owner-only (payment_credentials RLS); members don't see it.
    isOwner ? getPaymentStatus(restaurantId) : Promise.resolve<PaymentStatus | null>(null),
  ])
  if (!restaurant) notFound()

  return (
    <PanoClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      kpis={kpis}
      hourlySales={hourlySales}
      initialFeed={initialFeed}
      topItems={topItems}
      tableStatuses={tableStatuses}
      heatmap={heatmap}
      paymentStatus={paymentStatus}
      isOwner={isOwner}
    />
  )
}
