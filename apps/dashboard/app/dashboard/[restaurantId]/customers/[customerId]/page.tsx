import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../../lib/queries/restaurants'
import { requireSection } from '../../../../../lib/auth/access'
import { getDashboardFeatureContext } from '../../../../../lib/queries/context'
import { readCustomerDetail } from '@garsonless/application/customers'
import { createCustomerApplicationPort } from '@garsonless/db/server'
import CustomerDetailClient from '../../../../../components/customers/CustomerDetailClient'

interface Props {
  params: Promise<{ restaurantId: string; customerId: string }>
}

export default async function CustomerDetailPage({ params }: Props) {
  const { restaurantId, customerId } = await params
  await requireSection(restaurantId, 'customers')
  const [restaurant, actor] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardFeatureContext(restaurantId),
  ])
  if (!restaurant || !actor) notFound()
  const detail = await readCustomerDetail(actor, { restaurantId, customerId }, createCustomerApplicationPort())
  if (!detail.ok) throw new Error(detail.error)
  if (!detail.value) notFound()

  return <CustomerDetailClient restaurantId={restaurantId} restaurantName={restaurant.name} detail={detail.value} canGrantStoreCredit={actor.isOwner === true} />
}
