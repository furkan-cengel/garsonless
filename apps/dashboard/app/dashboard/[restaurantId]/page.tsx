import { notFound } from 'next/navigation'
import {
  getRestaurantById,
  getDashboardKPIs,
  getHourlySales,
  getActivityFeed,
  getTopItems,
  getTableStatuses,
} from '../../../lib/queries'
import PanoClient from '../../../components/pano/PanoClient'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function PanoPage({ params }: Props) {
  const { restaurantId } = await params
  const [restaurant, kpis, hourlySales, initialFeed, topItems, tableStatuses] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardKPIs(restaurantId),
    getHourlySales(restaurantId),
    getActivityFeed(restaurantId),
    getTopItems(restaurantId),
    getTableStatuses(restaurantId),
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
    />
  )
}
