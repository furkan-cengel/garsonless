import { notFound, redirect } from 'next/navigation'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import { readThemeForEditor } from '@garsonless/application/themes'
import {
  canRestaurantUseFeature,
  createThemeApplicationPort,
  createThemePreviewAccessToken,
  listActivePublicCoupons,
  resolveThemePreviewSigningSecret,
} from '@garsonless/db/server'
import { getThemeEditorMenuRefs } from '../../../../../../lib/queries/theme-editor'
import ThemeEditorClientLoader from '../../../../../../components/theme/ThemeEditorClientLoader'
import { requireSection } from '../../../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string; templateId: string }>
}

export default async function ThemeEditPage({ params }: Props) {
  const { restaurantId, templateId } = await params
  const access = await requireSection(restaurantId, 'theme')
  if (templateId !== CANONICAL_THEME_ID) {
    redirect(`/dashboard/${restaurantId}/theme/${CANONICAL_THEME_ID}/edit`)
  }
  const [themeResult, menuRefs, initialCouponOptions] = await Promise.all([
    readThemeForEditor({
      actor: 'dashboard-member',
      userId: access.userId,
      restaurantId,
      permissions: ['theme'],
    }, { restaurantId, templateId }, createThemeApplicationPort()),
    getThemeEditorMenuRefs(restaurantId),
    listActivePublicCoupons(restaurantId),
  ])
  if (!themeResult.ok) {
    if (themeResult.error === 'Unknown theme template' || themeResult.error === 'Restaurant not found') notFound()
    throw new Error(themeResult.error)
  }
  const {
    restaurant,
    theme: initialTheme,
    publishedRevision: initialPublishedRevision,
    draftRevision: initialDraftRevision,
    draftSavedAt: initialDraftSavedAt,
    publishedAt: initialPublishedAt,
    hasUnpublishedChanges: initialHasUnpublishedChanges,
  } = themeResult.value
  const menuCategories = menuRefs.categories
  const menuItems = menuRefs.items
  const canAddAdvancedSections = await canRestaurantUseFeature({
    restaurantId,
    plan: restaurant.plan,
    feature: 'theme_advanced_sections',
  })
  const experienceV2Enabled = process.env['THEME_EXPERIENCE_V2_ENABLED'] === 'true' || process.env.NODE_ENV === 'development'
  const previewSigningSecret = resolveThemePreviewSigningSecret()
  if (!previewSigningSecret) throw new Error('Theme preview signing secret is missing')
  const previewAccessToken = createThemePreviewAccessToken({
    restaurantId,
    slug: restaurant.slug,
  }, previewSigningSecret)

  return (
    <ThemeEditorClientLoader
      restaurantId={restaurantId}
      restaurantSlug={restaurant.slug}
      restaurantName={restaurant.name}
      restaurantLogoUrl={restaurant.logoUrl}
      canAddAdvancedSections={canAddAdvancedSections}
      experienceV2Enabled={experienceV2Enabled}
      previewAccessToken={previewAccessToken}
      templateId={templateId}
      initialPersistence={{
        initialTheme,
        initialPublishedRevision,
        initialDraftRevision,
        initialDraftSavedAt,
        initialPublishedAt,
        initialHasUnpublishedChanges,
      }}
      restaurantSettings={restaurant.settings}
      initialCouponOptions={initialCouponOptions}
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
