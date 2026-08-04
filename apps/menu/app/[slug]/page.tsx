import { notFound } from 'next/navigation'
import { customerActorContext, readMemberLoyalty, type MemberBalances } from '@garsonless/application/loyalty'
import { createLoyaltyQueryPort } from '@garsonless/db/server'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import { getMenuCategories, getMenuItems, getRestaurantBySlug } from '../../lib/queries'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../lib/featured-products'
import { HomePageRenderer } from './HomePageClient'
import { getCustomerSession } from '../../lib/customer-session'
import { availableCustomerAuthProviders } from '../../lib/customer-auth-provider'
import { getPublishedTheme } from '../../lib/published-theme'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MenuPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const experienceV2Enabled = process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development'
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const themeResult = await getPublishedTheme(restaurant.id, restaurant.slug)
  if (!themeResult.ok) notFound()
  const homeEnabled = experienceV2Enabled && themeResult.value.theme.surfaces?.home.enabled === true

  if (!homeEnabled) {
    const { renderMenuExperience } = await import('./_menu-experience')
    return renderMenuExperience({ slug, sp })
  }

  const [categories, featuredRanking, session, customerAuthProviders] = await Promise.all([
    getMenuCategories(restaurant.id),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
    getCustomerSession(),
    availableCustomerAuthProviders(),
  ])
  const [menuItems, memberBalancesResult] = await Promise.all([
    getMenuItems(restaurant.id, categories.map((category) => category.id)),
    session
      ? readMemberLoyalty(customerActorContext({ authUserId: session.authUserId, customerId: session.customerId, restaurantId: restaurant.id }), createLoyaltyQueryPort())
      : Promise.resolve(null),
  ])
  const items = applyFeaturedProductRanking(menuItems, featuredRanking)
  const initialMember = session ? { name: session.name } : null
  const initialMemberBalances: MemberBalances | null = memberBalancesResult?.ok ? memberBalancesResult.value : null
  return (
    <HomePageRenderer
      restaurant={restaurant}
      categories={categories as MenuCategory[]}
      items={items as MenuItem[]}
      theme={themeResult.value.theme}
      initialMember={initialMember}
      initialMemberBalances={initialMemberBalances}
      customerAuthProviders={customerAuthProviders}
    />
  )
}
