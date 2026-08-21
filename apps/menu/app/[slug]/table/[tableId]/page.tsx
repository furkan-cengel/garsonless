import { notFound } from 'next/navigation'
import {
  customerActorContext,
  readMemberLoyalty,
  type MemberBalances,
} from '@garsonless/application/loyalty'
import { readPublicTableState } from '@garsonless/application/tables'
import { withoutAdvancedThemeSections } from '@garsonless/application/themes'
import { getRestaurantBySlug, getMenuCategories, getMenuItems } from '../../../../lib/queries'
import { getCustomerSession } from '../../../../lib/customer-session'
import { availableCustomerAuthCapabilities } from '../../../../lib/customer-auth-provider'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../../../lib/featured-products'
import { MenuPageClient } from '../../MenuPageClient'
import { HomePageRenderer } from '../../HomePageClient'
import { createLoyaltyQueryPort, createPublicTableQueryPort, createThemeApplicationPort } from '@garsonless/db/server'
import { getPublishedTheme } from '../../../../lib/published-theme'

// Reading the auth cookie makes this route dynamic anyway; align with the
// slug page instead of a stale ISR bill/session snapshot.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string; tableId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TableMenuPage({ params, searchParams }: Props) {
  const { slug, tableId } = await params
  const sp = await searchParams
  const initialCustomerAuthReturn = sp['customerAuth'] === 'complete'
    ? 'success'
    : sp['customerAuth'] === 'failed' ? 'error' : null
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const tableStateResult = await readPublicTableState(tableId, createPublicTableQueryPort())
  if (!tableStateResult.ok) throw new Error(tableStateResult.error)
  const tableState = tableStateResult.value
  if (!tableState || tableState.token.restaurantId !== restaurant.id || tableState.token.restaurantSlug !== slug) notFound()

  const themePort = createThemeApplicationPort()
  const [themeResult, categories, featuredRanking, session, customerAuthCapabilities] = await Promise.all([
    getPublishedTheme(restaurant.id),
    getMenuCategories(restaurant.id),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
    getCustomerSession(),
    availableCustomerAuthCapabilities(),
  ])
  if (!themeResult.ok) notFound()
  const tableSession = tableState.session
    ? { id: tableState.session.id, openedAt: tableState.session.opened_at }
    : null
  const sessionOrders = tableState.orders.map((row) => ({
    id: row.id,
    status: row.status,
    total: Number(row.total),
    paidAt: row.paid_at,
    createdAt: row.created_at,
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
  }))

  // Resolve a returning member from the Supabase Auth cookie, plus loyalty
  // balances — same pattern as the slug page; guests stay null.
  let initialMember: { name: string | null } | null = null
  let initialMemberBalances: MemberBalances | null = null
  const [menuAccess, guestOrderingAccess, requestButtonsAccess, customerAccountsAccess, advancedThemeAccess] = await Promise.all([
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'qr_menu' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'guest_ordering' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'service_requests' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'customer_accounts' }),
    themePort.readFeatureAccess({ restaurantId: restaurant.id, plan: themeResult.value.restaurant.plan, feature: 'theme_advanced_sections' }),
  ])
  if (!menuAccess.ok || !menuAccess.value) notFound()
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
  if (session) {
    initialMember = { name: session.name }
    initialMemberBalances = memberBalancesResult?.ok ? memberBalancesResult.value : null
  }

  const { theme, templateId } = themeResult.value
  // Entitlement and section presence are deliberately separate: the client
  // decides presence from the current (including live-preview) theme, while
  // this server result remains the authoritative PRO-plan gate.
  const requestButtonsEnabled = requestButtonsAccess?.ok === true && requestButtonsAccess.value
  const guestOrderingEnabled = guestOrderingAccess.ok && guestOrderingAccess.value
  const servedTheme = advancedThemeAccess.ok && advancedThemeAccess.value
    ? theme
    : withoutAdvancedThemeSections(theme)
  const experienceV2Enabled = process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development'
  const homeEnabled = experienceV2Enabled && servedTheme.surfaces?.home.enabled === true

  if (homeEnabled && sp['surface'] !== 'menu') {
    return (
      <HomePageRenderer
        restaurant={restaurant}
        categories={categories}
        items={items}
        theme={servedTheme}
        tableToken={tableId}
        tableLabel={tableState.token.tableLabel}
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

  return (
    <MenuPageClient
      restaurant={restaurant}
      categories={categories}
      items={items}
      theme={servedTheme}
      templateId={templateId}
      tableToken={tableId}
      tableLabel={tableState.token.tableLabel}
      initialTableSession={tableSession}
      initialSessionOrders={sessionOrders}
      initialMember={initialMember}
      initialMemberBalances={initialMemberBalances}
      initialCustomerAuthReturn={initialCustomerAuthReturn}
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
