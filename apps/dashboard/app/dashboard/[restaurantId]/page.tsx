import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../lib/queries/restaurants'
import { getPanoSnapshot } from '../../../lib/queries/pano'
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

  const [restaurant, snapshot] = await Promise.all([
    getRestaurantById(restaurantId),
    getPanoSnapshot(restaurantId),
  ])
  if (!restaurant) notFound()

  return (
    <PanoClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      generatedAt={snapshot.generatedAt}
      timezone={snapshot.timezone}
      initialErrors={snapshot.errors}
      permissions={access.permissions}
      kpis={snapshot.kpis}
      orderSummary={snapshot.orderSummary}
      attentionItems={snapshot.attentionItems}
      hourlySales={snapshot.hourlySales}
      initialFeed={snapshot.initialFeed}
      topItems={snapshot.topItems}
      tableStatuses={snapshot.tableStatuses}
      heatmap={snapshot.heatmap}
      pendingServiceRequests={snapshot.pendingServiceRequests}
      paymentStatus={snapshot.paymentStatus}
      isOwner={isOwner}
    />
  )
}
