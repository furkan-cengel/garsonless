import { notFound } from 'next/navigation'
import {
  customerActorContext,
  readMemberLoyalty,
  type MemberBalances,
} from '@garsonless/application/loyalty'
import { withoutAdvancedThemeSections } from '@garsonless/application/themes'
import { createLoyaltyQueryPort, createThemeApplicationPort } from '@garsonless/db/server'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import { getMenuCategories, getMenuItems, getPreviewRestaurantBySlug, getRestaurantBySlug } from '../../lib/queries'
import { getCustomerSession } from '../../lib/customer-session'
import { availableCustomerAuthCapabilities } from '../../lib/customer-auth-provider'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../lib/featured-products'
import { MenuPageClient } from './MenuPageClient'
import { getPreviewTheme, getPublishedTheme } from '../../lib/published-theme'
import { hasThemePreviewAccess } from '../../lib/theme-preview-access'

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
  const restaurant = isPreview
    ? await getPreviewRestaurantBySlug(slug)
    : await getRestaurantBySlug(slug)
  if (!restaurant) notFound()
  const previewAccessGranted = isPreview && hasThemePreviewAccess({
    token: sp['previewAccess'],
    restaurantId: restaurant.id,
    slug: restaurant.slug,
  })
  if (isPreview && !previewAccessGranted) notFound()

  const themePort = createThemeApplicationPort()
  const [themeResult, categories, featuredRanking, session, customerAuthCapabilities] = await Promise.all([
    isPreview && previewTemplate
      ? getPreviewTheme(restaurant.id, previewTemplate)
      : getPublishedTheme(restaurant.id),
    getMenuCategories(restaurant.id),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
    getCustomerSession(),
    availableCustomerAuthCapabilities(),
  ])
  if (!themeResult.ok) notFound()

  const { theme, templateId } = themeResult.value
  const [menuAccess, guestOrderingAccess, requestButtonsAccess, customerAccountsAccess, advancedThemeAccess] = await Promise.all([
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'qr_menu' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'guest_ordering' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'service_requests' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'customer_accounts' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'theme_advanced_sections' }),
  ])
  if (!previewAccessGranted && (!menuAccess.ok || !menuAccess.value)) notFound()
  const customerAccountsEnabled = customerAccountsAccess.ok && customerAccountsAccess.value
  const [menuItems, memberBalancesResult] = await Promise.all([
    getMenuItems(restaurant.id, categories.map((category) => category.id)),
    session && customerAccountsEnabled
      ? readMemberLoyalty(customerActorContext({
          authUserId: session.authUserId,
          customerId: session.customerId,
          restaurantId: restaurant.id,
        }), createLoyaltyQueryPort())
      : Promise.resolve(null),
  ])
  const items = applyFeaturedProductRanking(menuItems, featuredRanking)
  const requestButtonsEnabled = requestButtonsAccess?.ok === true && requestButtonsAccess.value
  const guestOrderingEnabled = guestOrderingAccess.ok && guestOrderingAccess.value
  const servedTheme = advancedThemeAccess.ok && advancedThemeAccess.value
    ? theme
    : withoutAdvancedThemeSections(theme)
  const experienceV2Enabled = process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development'
  const homeEnabled = !isPreview && experienceV2Enabled && servedTheme.surfaces?.home.enabled === true

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
      theme={servedTheme}
      templateId={templateId}
      initialMember={initialMember}
      initialMemberBalances={initialMemberBalances}
      initialCustomerAuthReturn={initialCustomerAuthReturn}
      isPreview={isPreview}
      requestButtonsEnabled={requestButtonsEnabled}
      guestOrderingEnabled={guestOrderingEnabled}
      customerAccountsEnabled={customerAccountsEnabled}
      customerAuthProviders={customerAccountsEnabled
        ? (['google', 'apple'] as const).filter((provider) => customerAuthCapabilities.oauth[provider])
        : []}
      emailOtpEnabled={customerAccountsEnabled && customerAuthCapabilities.emailOtp}
      phoneOtpEnabled={customerAccountsEnabled && customerAuthCapabilities.phoneOtp}
      initialOpenCart={sp['open'] === 'cart'}
      initialProductId={typeof sp['item'] === 'string' ? sp['item'] : null}
      initialPromotionSectionId={typeof sp['promotionSection'] === 'string' ? sp['promotionSection'] : null}
      initialPromotionKind={typeof sp['promotionKind'] === 'string' ? sp['promotionKind'] : null}
      homeEnabled={homeEnabled}
    />
  )
}
