import { notFound } from 'next/navigation'
import {
  customerActorContext,
  readMemberLoyalty,
  type MemberBalances,
} from '@garsonless/application/loyalty'
import { readPublishedTheme } from '@garsonless/application/themes'
import { createLoyaltyQueryPort, createThemeApplicationPort } from '@garsonless/db/server'
import type { MenuCategory, MenuItem } from '@garsonless/ui'
import { getRestaurantBySlug, getMenuCategories, getMenuItems } from '../../lib/queries'
import { getCustomerSession } from '../../lib/customer-session'
import { availableCustomerAuthProviders } from '../../lib/customer-auth-provider'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../lib/featured-products'
import { MenuPageClient } from './MenuPageClient'

export async function renderMenuExperience({
  slug,
  sp,
}: {
  slug: string
  sp: Record<string, string | string[] | undefined>
}) {
  const isPreview = sp['preview'] === '1'
  const initialCustomerAuthReturn = sp['customerAuth'] === 'complete'
    ? 'success'
    : sp['customerAuth'] === 'failed' ? 'error' : null
  const previewTemplate = typeof sp['template'] === 'string' ? sp['template'] : null
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const themePort = createThemeApplicationPort()
  const [themeResult, categories, featuredRanking, session, customerAuthProviders] = await Promise.all([
    readPublishedTheme({
      restaurantId: restaurant.id,
      templateOverride: isPreview && previewTemplate ? previewTemplate : null,
    }, themePort),
    getMenuCategories(restaurant.id),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
    getCustomerSession(),
    availableCustomerAuthProviders(),
  ])
  if (!themeResult.ok) notFound()

  const { theme, templateId } = themeResult.value
  const [menuItems, requestButtonsAccess, memberBalancesResult] = await Promise.all([
    getMenuItems(restaurant.id, categories.map((category) => category.id)),
    themePort.readFeatureAccess({
      restaurantId: restaurant.id,
      plan: themeResult.value.restaurant.plan,
      feature: 'theme_advanced_sections',
    }),
    session
      ? readMemberLoyalty(customerActorContext({
          authUserId: session.authUserId,
          customerId: session.customerId,
          restaurantId: restaurant.id,
        }), createLoyaltyQueryPort())
      : Promise.resolve(null),
  ])
  const items = applyFeaturedProductRanking(menuItems, featuredRanking)
  const requestButtonsEnabled = requestButtonsAccess?.ok === true && requestButtonsAccess.value

  let initialMember: { name: string | null } | null = null
  let initialMemberBalances: MemberBalances | null = null
  if (session) {
    initialMember = { name: session.name }
    initialMemberBalances = memberBalancesResult?.ok ? memberBalancesResult.value : null
  }

  return (
    <MenuPageClient
      restaurant={restaurant}
      categories={categories as MenuCategory[]}
      items={items as MenuItem[]}
      theme={theme}
      templateId={templateId}
      initialMember={initialMember}
      initialMemberBalances={initialMemberBalances}
      initialCustomerAuthReturn={initialCustomerAuthReturn}
      isPreview={isPreview}
      requestButtonsEnabled={requestButtonsEnabled}
      customerAuthProviders={customerAuthProviders}
      initialOpenCart={sp['open'] === 'cart'}
      initialProductId={typeof sp['item'] === 'string' ? sp['item'] : null}
    />
  )
}
