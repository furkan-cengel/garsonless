import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../../lib/queries'
import { assertAccess, requireSection } from '../../../../../lib/auth/access'
import { readCustomerDetail } from '@garsonless/application/customers'
import { createCustomerApplicationPort } from '@garsonless/db/server'
import CustomerDetailClient from '../../../../../components/customers/CustomerDetailClient'

interface Props {
  params: Promise<{ restaurantId: string; customerId: string }>
}

export default async function CustomerDetailPage({ params }: Props) {
  const { restaurantId, customerId } = await params
  await requireSection(restaurantId, 'customers')
  const gate = await assertAccess(restaurantId, 'customers')
  if ('error' in gate) throw new Error(gate.error)
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  const detail = await readCustomerDetail({
    actor: 'dashboard-member',
    restaurantId,
    userId: gate.userId,
    permissions: ['customers'],
  }, { restaurantId, customerId }, createCustomerApplicationPort())
  if (!detail.ok) throw new Error(detail.error)
  if (!detail.value) notFound()

  return <CustomerDetailClient restaurantId={restaurantId} restaurantName={restaurant.name} detail={detail.value} />
}
