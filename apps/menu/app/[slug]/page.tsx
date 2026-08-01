import { notFound } from 'next/navigation'
import {
  customerActorContext,
  readMemberLoyalty,
  type MemberBalances,
} from '@garsonless/application/loyalty'
import { readPublishedTheme } from '@garsonless/application/themes'
import { createLoyaltyQueryPort, createThemeApplicationPort } from '@garsonless/db/server'
import { getRestaurantBySlug, getMenuCategories, getMenuItems } from '../../lib/queries'
import { getCustomerSession } from '../../lib/customer-session'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../lib/featured-products'
import { MenuPageClient } from './MenuPageClient'
import type { MenuItem, MenuCategory } from '@garsonless/ui'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const isPreview = sp['preview'] === '1'
  const previewTemplate = typeof sp['template'] === 'string' ? sp['template'] : null
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const themePort = createThemeApplicationPort()
  const [themeResult, categories, featuredRanking, session] = await Promise.all([
    readPublishedTheme({
      restaurantId: restaurant.id,
      templateOverride: isPreview && previewTemplate ? previewTemplate : null,
    }, themePort),
    getMenuCategories(restaurant.id),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
    getCustomerSession(),
  ])
  if (!themeResult.ok) notFound()

  // Resolved through the shared helper so the SSR layout's <style> and this
  // client initialTheme are always identical (no first-load color flash).
  const { theme, templateId } = themeResult.value
  // Resolve the entitlement independently from the published section list.
  // Theme preview can add the global request tool through the live bridge
  // before it is published; tying access to the persisted blocks would leave
  // the preview stuck at `false` until a hard reload after publishing.
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

  // Resolve a returning member from the Supabase Auth cookie, plus loyalty
  // balances (service-role, scoped to this customer + restaurant).
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
      isPreview={isPreview}
      requestButtonsEnabled={requestButtonsEnabled}
    />
  )
}
