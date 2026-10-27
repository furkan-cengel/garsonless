import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../../lib/queries/restaurants'
import { requireSection } from '../../../../../lib/auth/access'
import { getDashboardFeatureContext } from '../../../../../lib/queries/context'
import { readCustomerRewardRules } from '@garsonless/application/customers'
import { canRestaurantUseFeature, createCustomerApplicationPort } from '@garsonless/db/server'
import CustomerRewardsClient from '../../../../../components/customers/CustomerRewardsClient'
import PlanLockedPanel from '../../../../../components/PlanLockedPanel'
import { readBillingPlanPrices } from '../../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function CustomerRewardsPage({ params }: Props) {
  const { restaurantId } = await params
  const access = await requireSection(restaurantId, 'customers')
  const [restaurant, actor] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardFeatureContext(restaurantId),
  ])
  // Automatic rewards pay out points, so the page is the owner's alone.
  if (!restaurant || !actor || actor.isOwner !== true) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'customer_accounts' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="customer_accounts" isOwner={access.isOwner} planPrices={readBillingPlanPrices()} />
  }
  const rules = await readCustomerRewardRules(actor, restaurantId, createCustomerApplicationPort())
  if (!rules.ok) throw new Error(rules.error)
  const loyalty = (restaurant.settings as { loyalty?: { points_enabled?: boolean } } | null)?.loyalty

  return (
    <CustomerRewardsClient
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initialRules={rules.value}
      pointsEnabled={loyalty?.points_enabled === true}
    />
  )
}
