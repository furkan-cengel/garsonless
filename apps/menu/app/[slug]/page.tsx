import { notFound } from 'next/navigation'
import { customerActorContext, readMemberLoyalty, type MemberBalances } from '@garsonless/application/loyalty'
import { projectThemeForEntitlements } from '@garsonless/application/themes'
import { createLoyaltyQueryPort, createThemeApplicationPort, readTenantOrderIngressStatus } from '@garsonless/db/server'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import { getMenuCatalog, getRestaurantBySlug } from '../../lib/queries'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../lib/featured-products'
import { HomePageRenderer } from './HomePageClient'
import { getCustomerSession } from '../../lib/customer-session'
import { availableCustomerAuthCapabilities } from '../../lib/customer-auth-provider'
import { getPublishedTheme } from '../../lib/published-theme'
import { getPublicMenuRevision } from '../../lib/public-menu-revision'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MenuPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const experienceV2Enabled = process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development'
  if (!experienceV2Enabled) {
    const { renderMenuExperience } = await import('./_menu-experience')
    return renderMenuExperience({ slug, sp })
  }
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const [themeResult, revisionSnapshot] = await Promise.all([
    getPublishedTheme(restaurant.id),
    getPublicMenuRevision(restaurant.id),
  ])
  if (!themeResult.ok) notFound()
  if (themeResult.value.theme.surfaces?.home.enabled !== true) {
    const { renderMenuExperience } = await import('./_menu-experience')
    return renderMenuExperience({ slug, sp })
  }
  const themePort = createThemeApplicationPort()
  const [access, { categories, items: menuItems }, featuredRanking, session, customerAuthCapabilities] = await Promise.all([
    Promise.all([
      themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'qr_menu' }),
      themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'guest_ordering' }),
      themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'customer_accounts' }),
      themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'theme_advanced_sections' }),
      themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'theme_video_hero' }),
      readTenantOrderIngressStatus(restaurant.id),
    ]),
    getMenuCatalog(restaurant.id, revisionSnapshot.revision),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
    getCustomerSession(),
    availableCustomerAuthCapabilities(),
  ])
  const [menuAccess, guestOrderingAccess, customerAccountsAccess, advancedThemeAccess, videoHeroAccess, orderIngressStatus] = access
  if (!menuAccess.ok || !menuAccess.value) notFound()
  const customerAccountsEnabled = customerAccountsAccess.ok && customerAccountsAccess.value
  const guestOrderingEnabled = guestOrderingAccess.ok && guestOrderingAccess.value && orderIngressStatus === 'active'
  const theme = projectThemeForEntitlements(themeResult.value.theme, {
    advancedSections: advancedThemeAccess.ok && advancedThemeAccess.value,
    videoHero: videoHeroAccess.ok && videoHeroAccess.value,
  })
  const memberBalancesResult = session && customerAccountsEnabled
    ? await readMemberLoyalty(customerActorContext({ authUserId: session.authUserId, customerId: session.customerId, restaurantId: restaurant.id }), createLoyaltyQueryPort())
    : null
  const items = applyFeaturedProductRanking(menuItems, featuredRanking)
  const initialMember = session && customerAccountsEnabled ? { name: session.name } : null
  const initialMemberBalances: MemberBalances | null = memberBalancesResult?.ok ? memberBalancesResult.value : null
  return (
    <HomePageRenderer
      restaurant={restaurant}
      categories={categories as MenuCategory[]}
      items={items as MenuItem[]}
      theme={theme}
      initialMember={initialMember}
      initialMemberBalances={initialMemberBalances}
      guestOrderingEnabled={guestOrderingEnabled}
      customerAccountsEnabled={customerAccountsEnabled}
      customerAuthProviders={customerAccountsEnabled
        ? (['google', 'apple'] as const).filter((provider) => customerAuthCapabilities.oauth[provider])
        : []}
      emailOtpEnabled={customerAccountsEnabled && customerAuthCapabilities.emailOtp}
      phoneOtpEnabled={customerAccountsEnabled && customerAuthCapabilities.phoneOtp}
    />
  )
}
