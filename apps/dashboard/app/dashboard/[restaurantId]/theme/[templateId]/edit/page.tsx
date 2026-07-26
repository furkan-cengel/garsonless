import { notFound, redirect } from 'next/navigation'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import { readThemeForEditor } from '@garsonless/application/themes'
import { canRestaurantUseFeature, createThemeApplicationPort } from '@garsonless/db/server'
import { getThemeEditorMenuRefs } from '../../../../../../lib/queries/theme-editor'
import ThemeEditorClientLoader from '../../../../../../components/theme/ThemeEditorClientLoader'
import { assertAccess, requireSection } from '../../../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string; templateId: string }>
}

export default async function ThemeEditPage({ params }: Props) {
  const { restaurantId, templateId } = await params
  await requireSection(restaurantId, 'theme')
  if (templateId !== CANONICAL_THEME_ID) {
    redirect(`/dashboard/${restaurantId}/theme/${CANONICAL_THEME_ID}/edit`)
  }
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
  const canAddAdvancedSections = await canRestaurantUseFeature({
    restaurantId,
    plan: restaurant.plan,
    feature: 'theme_advanced_sections',
  })

  return (
    <ThemeEditorClientLoader
      restaurantId={restaurantId}
      restaurantSlug={restaurant.slug}
      restaurantName={restaurant.name}
      restaurantLogoUrl={restaurant.logoUrl}
      canAddAdvancedSections={canAddAdvancedSections}
      templateId={templateId}
      initialTheme={initialTheme}
      restaurantSettings={restaurant.settings}
      menuCategories={menuCategories.map((category) => ({
        id: category.id,
        name: category.name,
        parentId: category.parent_id ?? null,
        imageUrl: category.image_url ?? null,
      }))}
      menuItems={menuItems.map((item) => {
        const category = menuCategories.find((candidate) => candidate.id === item.category_id)
        return {
          id: item.id,
          categoryId: item.category_id,
          categoryName: category?.name ?? 'Kategorisiz',
          name: item.name,
          description: item.description,
          price: Number(item.price),
          images: item.images,
          ingredients: item.ingredients,
          energyKcal: item.energy_kcal,
          containsAllergens: item.contains_allergens,
          mayContainAllergens: item.may_contain_allergens,
          allergenNote: item.allergen_note,
          crossContactNote: item.cross_contact_note,
          containsAlcohol: item.contains_alcohol,
          containsPork: item.contains_pork,
          isVegetarian: item.is_vegetarian,
          isVegan: item.is_vegan,
          isHalal: item.is_halal,
          foodInfoReviewedAt: item.food_info_reviewed_at,
          modifierGroups: item.modifier_groups,
          isAvailable: item.is_available,
          position: item.position,
        }
      })}
    />
  )
}
