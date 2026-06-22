import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { DEFAULT_THEME, TEMPLATES } from '@garsonless/design-engine'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { verifyCustomerSession, CUSTOMER_SESSION_COOKIE, createServiceClient, getMemberBalances } from '@garsonless/db'
import type { MemberBalances } from '@garsonless/db'
import { getRestaurantBySlug, getThemeConfig, getMenuCategories, getMenuItems } from '../../lib/queries'
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

  const [themeConfig, categories] = await Promise.all([
    getThemeConfig(restaurant.id),
    getMenuCategories(restaurant.id),
  ])

  const items = await getMenuItems(categories.map((c) => c.id))

  const restaurantSettings = restaurant.settings as Record<string, unknown> | null
  const savedTemplateId = typeof restaurantSettings?.['active_template_id'] === 'string'
    ? restaurantSettings['active_template_id']
    : 'default'
  const templateId = isPreview && previewTemplate ? previewTemplate : savedTemplateId
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

  // Resolve a returning member from the httpOnly customer-session cookie (menu app only),
  // plus their loyalty balances (service-role, scoped to this customer + restaurant).
  let initialMember: { name: string | null } | null = null
  let initialMemberBalances: MemberBalances | null = null
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
  const session = await verifyCustomerSession(token)
  if (session) {
    const svc = createServiceClient()
    const { data } = await svc.from('customers').select('name').eq('id', session.customerId).maybeSingle()
    initialMember = { name: (data as { name: string | null } | null)?.name ?? null }
    initialMemberBalances = await getMemberBalances(session.customerId, restaurant.id)
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
    />
  )
}
