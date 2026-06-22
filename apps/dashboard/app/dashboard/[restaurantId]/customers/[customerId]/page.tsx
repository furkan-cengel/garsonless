import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../../lib/queries'
import { getRestaurantCustomerDetail } from '@garsonless/db'
import CustomerDetailClient from '../../../../../components/customers/CustomerDetailClient'

interface Props {
  params: Promise<{ restaurantId: string; customerId: string }>
}

export default async function CustomerDetailPage({ params }: Props) {
  const { restaurantId, customerId } = await params
  // Owner gate (RLS) + activity-at-venue gate (returns null otherwise).
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  const detail = await getRestaurantCustomerDetail(restaurantId, customerId)
  if (!detail) notFound()

  return <CustomerDetailClient restaurantId={restaurantId} restaurantName={restaurant.name} detail={detail} />
}
