import { notFound } from 'next/navigation'
import { getMenuManagementData } from '../../../../lib/queries/menu-management'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import MenuManager from '../../../../components/menu/MenuManager'
import MenuLoadError from '../../../../components/menu/MenuLoadError'
import { requireSection } from '../../../../lib/auth/access'
import { readPublishedTheme } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function MenuPage({ params }: Props) {
  const { restaurantId } = await params
  const access = await requireSection(restaurantId, 'menu')
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'qr_menu' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="qr_menu" isOwner={access.isOwner} />
  }
  const [menuResult, themeResult] = await Promise.all([
    getMenuManagementData(restaurantId),
    readPublishedTheme({ restaurantId }, createThemeApplicationPort()),
  ])
  if (!menuResult.ok) return <MenuLoadError message={menuResult.error} />

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
    />
  )
}
