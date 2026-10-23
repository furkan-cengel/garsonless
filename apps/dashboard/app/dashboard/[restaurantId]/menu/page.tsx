import { notFound } from 'next/navigation'
import { getMenuManagementData } from '../../../../lib/queries/menu-management'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import MenuManager from '../../../../components/menu/MenuManagerBoundary'
import MenuLoadError from '../../../../components/menu/MenuLoadError'
import { requireSection } from '../../../../lib/auth/access'
import { readPublishedTheme } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'
import { readBillingPlanPrices } from '../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function MenuPage({ params }: Props) {
  const { restaurantId } = await params
  const access = await requireSection(restaurantId, 'menu')
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'qr_menu' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="qr_menu" isOwner={access.isOwner} planPrices={readBillingPlanPrices()} />
  }
  const [menuResult, themeResult, guestOrderingEnabled, loyaltyEnabled] = await Promise.all([
    getMenuManagementData(restaurantId),
    readPublishedTheme({ restaurantId }, createThemeApplicationPort()),
    canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'guest_ordering' }),
    canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'loyalty' }),
  ])
  if (!menuResult.ok) return <MenuLoadError restaurantName={restaurant.name} message={menuResult.error} code={menuResult.code} occurredAt={new Date().toISOString()} />

  const { categories, items, kitchenStations, recommendations, recommendationsAvailable } = menuResult.data
  const experienceV2Enabled = process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development'
  const homeEnabled = experienceV2Enabled && themeResult.ok && themeResult.value.theme.surfaces?.home.enabled === true

  return (
    <MenuManager
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      publicMenuPath={`/${restaurant.slug}${homeEnabled ? '/menu' : ''}`}
      initialCategories={categories}
      initialItems={items}
      kitchenStations={kitchenStations}
      initialRecommendations={recommendations}
      recommendationsAvailable={recommendationsAvailable}
      orderingFeaturesEnabled={guestOrderingEnabled}
      loyaltyStampEnabled={guestOrderingEnabled && loyaltyEnabled}
    />
  )
}
