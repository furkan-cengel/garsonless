import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries'
import { getRestaurantCustomers, listCampaigns, listCustomerSegments } from '@garsonless/db'
import CustomersClient from '../../../../components/customers/CustomersClient'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function CustomersPage({ params }: Props) {
  const { restaurantId } = await params
  // getRestaurantById is RLS owner-scoped → null (notFound) for non-owners.
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()

  const [initial, initialSegments, initialCampaigns] = await Promise.all([
    getRestaurantCustomers(restaurantId, { sort: 'last_seen', page: 1, pageSize: 25 }),
    listCustomerSegments(restaurantId),
    listCampaigns(restaurantId),
  ])

  return (
    <CustomersClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initial={initial}
      initialSegments={initialSegments}
      initialCampaigns={initialCampaigns}
    />
  )
}
