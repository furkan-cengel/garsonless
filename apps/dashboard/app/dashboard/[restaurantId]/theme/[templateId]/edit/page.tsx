import { notFound } from 'next/navigation'
import { readThemeForEditor } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { getThemeEditorMenuRefs } from '../../../../../../lib/queries'
import ThemeEditorClientLoader from '../../../../../../components/theme/ThemeEditorClientLoader'
import { assertAccess, requireSection } from '../../../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string; templateId: string }>
}

export default async function ThemeEditPage({ params }: Props) {
  const { restaurantId, templateId } = await params
  await requireSection(restaurantId, 'theme')
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) notFound()

  const [themeResult, menuRefs] = await Promise.all([
    readThemeForEditor({
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId,
      permissions: ['theme'],
    }, { restaurantId, templateId }, createThemeApplicationPort()),
    getThemeEditorMenuRefs(restaurantId),
  ])
  if (!themeResult.ok) {
    if (themeResult.error === 'Unknown theme template' || themeResult.error === 'Restaurant not found') notFound()
    throw new Error(themeResult.error)
  }
  const { restaurant, theme: initialTheme } = themeResult.value
  const menuCategories = menuRefs.categories
  const menuItems = menuRefs.items

  return (
    <ThemeEditorClientLoader
      restaurantId={restaurantId}
      restaurantSlug={restaurant.slug}
      restaurantName={restaurant.name}
      restaurantLogoUrl={restaurant.logoUrl}
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
