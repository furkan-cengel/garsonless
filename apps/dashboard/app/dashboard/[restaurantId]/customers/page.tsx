import { notFound, redirect } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries'
import { getUserRestaurantAccess, firstPermittedPath } from '../../../../lib/auth/access'
import { getRestaurantCustomers, getRestaurantCustomerSegmentCounts, listCampaigns, listCustomerSegments } from '@garsonless/db'
import CustomersClient from '../../../../components/customers/CustomersClient'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function CustomersPage({ params }: Props) {
  const { restaurantId } = await params
  // INTERIM GUARD (Phase 2): customer PII below loads via the SERVICE ROLE, so it
  // is NOT RLS-gated — the 'customers' section must be enforced here or a member
  // without it would read PII. (Full per-route sweep is Phase 3.)
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) notFound()
  if (!access.isOwner && !access.permissions.includes('customers')) {
    redirect(firstPermittedPath(restaurantId, access))
  }
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()

  const [initial, initialSegmentCounts, initialSegments, initialCampaigns] = await Promise.all([
    getRestaurantCustomers(restaurantId, { sort: 'last_seen', page: 1, pageSize: 25 }),
    getRestaurantCustomerSegmentCounts(restaurantId),
    listCustomerSegments(restaurantId),
    listCampaigns(restaurantId),
  ])

  return (
    <CustomersClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initial={initial}
      initialSegmentCounts={{ all: initial.total, ...initialSegmentCounts }}
      initialSegments={initialSegments}
      initialCampaigns={initialCampaigns}
    />
  )
}
