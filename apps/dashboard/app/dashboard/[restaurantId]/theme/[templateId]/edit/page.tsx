import { notFound } from 'next/navigation'
import { DEFAULT_THEME } from '@garsonless/design-engine'
import { TEMPLATES } from '@garsonless/design-engine'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { getRestaurantById, getThemeConfigForRestaurant, getThemeEditorMenuRefs } from '../../../../../../lib/queries'
import ThemeEditorClientLoader from '../../../../../../components/theme/ThemeEditorClientLoader'
import { requireSection } from '../../../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string; templateId: string }>
}

export default async function ThemeEditPage({ params }: Props) {
  const { restaurantId, templateId } = await params
  await requireSection(restaurantId, 'theme')

  const [restaurant, themeConfig, menuRefs] = await Promise.all([
    getRestaurantById(restaurantId),
    getThemeConfigForRestaurant(restaurantId),
    getThemeEditorMenuRefs(restaurantId),
  ])
  if (!restaurant) notFound()

  const templateDefaults = TEMPLATES[templateId] ?? DEFAULT_THEME
  const rawRecord = themeConfig?.tokens as Record<string, unknown> | null | undefined
  const rawTemplateId = typeof rawRecord?.['__template_id'] === 'string'
    ? rawRecord['__template_id']
    : null
  // Saved tokens belong to the template they were saved for — load them
  // whenever they match the template being edited. Which template is LIVE
  // (settings.active_template_id) must not discard saved editor state.
  const raw = rawTemplateId === templateId || (rawTemplateId === null && templateId === 'default')
    ? rawRecord
    : null
  const initialTheme: GarsonlessTheme =
    raw != null && typeof raw === 'object' && 'bg' in (raw as object)
      ? { ...templateDefaults, ...(raw as Partial<GarsonlessTheme>) }
      : templateDefaults
  const menuCategories = menuRefs.categories
  const menuItems = menuRefs.items

  return (
    <ThemeEditorClientLoader
      restaurantId={restaurantId}
      restaurantSlug={restaurant.slug}
      restaurantName={restaurant.name}
      restaurantLogoUrl={(restaurant as Record<string, unknown>)['logo_url'] as string | null ?? null}
      templateId={templateId}
      initialTheme={initialTheme}
      menuCategories={menuCategories.map((category) => ({
        id: category.id,
        name: category.name,
        parentId: category.parent_id ?? null,
      }))}
      menuItems={menuItems.map((item) => {
        const category = menuCategories.find((cat) => cat.id === item.category_id)
        return {
          id: item.id,
          name: item.name,
          categoryId: item.category_id,
          categoryName: category?.name ?? 'Kategorisiz',
        }
      })}
    />
  )
}
