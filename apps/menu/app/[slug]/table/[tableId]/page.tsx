import { notFound } from 'next/navigation'
import {
  customerActorContext,
  readMemberLoyalty,
  type MemberBalances,
} from '@garsonless/application/loyalty'
import { readPublishedTheme } from '@garsonless/application/themes'
import { readPublicTableState } from '@garsonless/application/tables'
import { getRestaurantBySlug, getMenuCategories, getMenuItems } from '../../../../lib/queries'
import { getCustomerSession } from '../../../../lib/customer-session'
import { availableCustomerAuthProviders } from '../../../../lib/customer-auth-provider'
import { applyFeaturedProductRanking, getFeaturedProductRanking } from '../../../../lib/featured-products'
import { MenuPageClient } from '../../MenuPageClient'
import { createLoyaltyQueryPort, createPublicTableQueryPort, createThemeApplicationPort } from '@garsonless/db/server'

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
  const [themeResult, categories, featuredRanking, session, customerAuthProviders] = await Promise.all([
    readPublishedTheme({ restaurantId: restaurant.id }, themePort),
    getMenuCategories(restaurant.id),
    getFeaturedProductRanking(restaurant.id, restaurant.timezone),
    getCustomerSession(),
    availableCustomerAuthProviders(),
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
  if (session) {
    initialMember = { name: session.name }
    initialMemberBalances = memberBalancesResult?.ok ? memberBalancesResult.value : null
  }

  const { theme, templateId } = themeResult.value
  // Entitlement and section presence are deliberately separate: the client
  // decides presence from the current (including live-preview) theme, while
  // this server result remains the authoritative PRO-plan gate.
  const requestButtonsEnabled = requestButtonsAccess?.ok === true && requestButtonsAccess.value

  return (
    <MenuPageClient
      restaurant={restaurant}
      categories={categories}
      items={items}
      theme={theme}
      templateId={templateId}
      tableToken={tableId}
      tableLabel={tableState.token.tableLabel}
      initialTableSession={tableSession}
      initialSessionOrders={sessionOrders}
      initialMember={initialMember}
      initialMemberBalances={initialMemberBalances}
      initialCustomerAuthReturn={initialCustomerAuthReturn}
      requestButtonsEnabled={requestButtonsEnabled}
      customerAuthProviders={customerAuthProviders}
    />
  )
}
