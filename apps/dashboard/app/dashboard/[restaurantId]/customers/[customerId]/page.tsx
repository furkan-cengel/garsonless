import { notFound, redirect } from 'next/navigation'
import { getRestaurantById } from '../../../../../lib/queries'
import { getUserRestaurantAccess, firstPermittedPath } from '../../../../../lib/auth/access'
import { getRestaurantCustomerDetail } from '@garsonless/db'
import CustomerDetailClient from '../../../../../components/customers/CustomerDetailClient'

interface Props {
  params: Promise<{ restaurantId: string; customerId: string }>
}

export default async function CustomerDetailPage({ params }: Props) {
  const { restaurantId, customerId } = await params
  // INTERIM GUARD (Phase 2): detail loads customer PII via the service role —
  // enforce the 'customers' section here (not RLS-gated).
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) notFound()
  if (!access.isOwner && !access.permissions.includes('customers')) {
    redirect(firstPermittedPath(restaurantId, access))
  }
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  const detail = await getRestaurantCustomerDetail(restaurantId, customerId)
  if (!detail) notFound()

  return <CustomerDetailClient restaurantId={restaurantId} restaurantName={restaurant.name} detail={detail} />
}
