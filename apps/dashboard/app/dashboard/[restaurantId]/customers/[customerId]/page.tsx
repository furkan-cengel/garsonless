import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../../lib/queries/restaurants'
import { requireSection } from '../../../../../lib/auth/access'
import { getDashboardFeatureContext } from '../../../../../lib/queries/context'
import { readCustomerDetail } from '@garsonless/application/customers'
import { canRestaurantUseFeature, createCustomerApplicationPort } from '@garsonless/db/server'
import CustomerDetailClient from '../../../../../components/customers/CustomerDetailClient'
import { safeCustomerListReturnPath } from '../../../../../components/customers/customer-list-state'

import PlanLockedPanel from '../../../../../components/PlanLockedPanel'
import { readBillingPlanPrices } from '../../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string; customerId: string }>
  searchParams: Promise<{ returnTo?: string | string[] }>
}

export default async function CustomerDetailPage({ params, searchParams }: Props) {
  const [{ restaurantId, customerId }, query] = await Promise.all([params, searchParams])
  const access = await requireSection(restaurantId, 'customers')
  const [restaurant, actor] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardFeatureContext(restaurantId),
  ])
  if (!restaurant || !actor) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'customer_accounts' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="customer_accounts" isOwner={access.isOwner} planPrices={readBillingPlanPrices()} />
  }
  const detail = await readCustomerDetail(actor, { restaurantId, customerId }, createCustomerApplicationPort())
  if (!detail.ok) throw new Error(detail.error)
  if (!detail.value) notFound()

  const returnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo
  return <CustomerDetailClient restaurantId={restaurantId} restaurantName={restaurant.name} detail={detail.value} canGrantStoreCredit={actor.isOwner === true} backHref={safeCustomerListReturnPath(restaurantId, returnTo)} />
}
