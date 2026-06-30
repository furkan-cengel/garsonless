import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyCustomerSession, CUSTOMER_SESSION_COOKIE, createServiceClient, getMemberBalances } from '@garsonless/db'
import type { MemberBalances } from '@garsonless/db'
import { getRestaurantBySlug, getThemeConfig, getMenuCategories, getMenuItems } from '../../lib/queries'
import { resolveMenuTheme } from '../../lib/resolve-theme'
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

  // Resolved through the shared helper so the SSR layout's <style> and this
  // client initialTheme are always identical (no first-load color flash).
  const { theme, templateId } = resolveMenuTheme({
    settings: restaurant.settings as Record<string, unknown> | null,
    themeTokens: themeConfig?.tokens,
    templateOverride: isPreview && previewTemplate ? previewTemplate : null,
  })

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
