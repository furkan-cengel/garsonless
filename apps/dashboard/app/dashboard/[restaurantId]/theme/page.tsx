import { notFound, redirect } from 'next/navigation'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import { requireSection } from '../../../../lib/auth/access'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'
import { readBillingPlanPrices } from '../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function ThemePage({ params }: Props) {
  const { restaurantId } = await params
  const access = await requireSection(restaurantId, 'theme')
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'theme_editor' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="theme_editor" isOwner={access.isOwner} planPrices={readBillingPlanPrices()} />
  }
  redirect(`/dashboard/${restaurantId}/theme/${CANONICAL_THEME_ID}/edit`)
}
