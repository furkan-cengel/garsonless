import { notFound } from 'next/navigation'
import { getMemberBalances } from '@garsonless/db'
import type { MemberBalances } from '@garsonless/db'
import { DEFAULT_THEME, TEMPLATES } from '@garsonless/design-engine'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getRestaurantBySlug, getThemeConfig, getMenuCategories, getMenuItems } from '../../../../lib/queries'
import { getCustomerSession } from '../../../../lib/customer-session'
import { MenuPageClient } from '../../MenuPageClient'
import { readPublicTableState } from '@garsonless/db/server'

// Reading the auth cookie makes this route dynamic anyway; align with the
// slug page instead of a stale ISR bill/session snapshot.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string; tableId: string }>
}

export default async function TableMenuPage({ params }: Props) {
  const { slug, tableId } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const tableState = await readPublicTableState(tableId)
  if (!tableState || tableState.token.restaurantId !== restaurant.id || tableState.token.restaurantSlug !== slug) notFound()

  const [themeConfig, categories] = await Promise.all([
    getThemeConfig(restaurant.id),
    getMenuCategories(restaurant.id),
  ])
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

  const items = await getMenuItems(categories.map((c) => c.id))

  // Resolve a returning member from the Supabase Auth cookie, plus loyalty
  // balances — same pattern as the slug page; guests stay null.
  let initialMember: { name: string | null } | null = null
  let initialMemberBalances: MemberBalances | null = null
  const session = await getCustomerSession()
  if (session) {
    initialMember = { name: session.name }
    initialMemberBalances = await getMemberBalances(session.customerId, restaurant.id)
  }

  const restaurantSettings = restaurant.settings as Record<string, unknown> | null
  const templateId = typeof restaurantSettings?.['active_template_id'] === 'string'
    ? restaurantSettings['active_template_id']
    : 'default'
  const baseTheme = TEMPLATES[templateId] ?? DEFAULT_THEME
  const raw = themeConfig?.tokens as unknown
  const rawTemplateId =
    raw != null && typeof raw === 'object' && typeof (raw as Record<string, unknown>)['__template_id'] === 'string'
      ? (raw as Record<string, unknown>)['__template_id']
      : null
  const theme: GarsonlessTheme =
    rawTemplateId === templateId && raw != null && typeof raw === 'object' && 'bg' in (raw as object)
      ? { ...baseTheme, ...(raw as Partial<GarsonlessTheme>) }
      : baseTheme

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
    />
  )
}
