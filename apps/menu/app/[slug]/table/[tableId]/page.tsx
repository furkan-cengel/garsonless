import { notFound } from 'next/navigation'
import { DEFAULT_THEME, TEMPLATES } from '@garsonless/design-engine'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getRestaurantBySlug, getThemeConfig, getMenuCategories, getMenuItems, getTableLabel, getOpenTableSession, getSessionOrders } from '../../../../lib/queries'
import { MenuPageClient } from '../../MenuPageClient'

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string; tableId: string }>
}

export default async function TableMenuPage({ params }: Props) {
  const { slug, tableId } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const [themeConfig, categories, tableLabel, tableSession] = await Promise.all([
    getThemeConfig(restaurant.id),
    getMenuCategories(restaurant.id),
    getTableLabel(restaurant.id, tableId),
    getOpenTableSession(restaurant.id, tableId),
  ])
  if (!tableLabel) notFound()

  const sessionOrders = tableSession ? await getSessionOrders(tableSession.id) : []

  const items = await getMenuItems(categories.map((c) => c.id))

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
      tableId={tableId}
      tableLabel={tableLabel}
      initialTableSession={tableSession}
      initialSessionOrders={sessionOrders}
    />
  )
}
