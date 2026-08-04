'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import {
  computeThemeVars,
  CustomSectionRenderer,
  deriveActivePromoSliderCampaigns,
  getDefiniteAllergens,
  readStoreInfo,
  sortAllergenCodes,
} from '@garsonless/ui'
import type { MenuCategory, MenuItem, PromoSliderCampaign } from '@garsonless/ui'
import {
  normalizeAllergenCodes,
  normalizeIngredients,
  normalizeModifierGroups,
} from '@garsonless/db/browser'

export interface ThemeEditorPreviewCategory {
  id: string
  name: string
  parentId?: string | null
  imageUrl?: string | null
}

export interface ThemeEditorPreviewItem {
  id: string
  categoryId: string
  categoryName: string
  name: string
  description: string | null
  price: number
  images: unknown
  ingredients: unknown
  energyKcal: number | null
  containsAllergens: unknown
  mayContainAllergens: unknown
  allergenNote: string | null
  crossContactNote: string | null
  containsAlcohol: boolean
  containsPork: boolean
  isVegetarian: boolean
  isVegan: boolean
  isHalal: boolean
  foodInfoReviewedAt: string | null
  modifierGroups: unknown
  isAvailable: boolean
  position: number
}

interface CanonicalSectionPreviewProps {
  surface?: 'menu' | 'home'
  sectionId: string
  theme: GarsonlessTheme
  restaurantName: string
  restaurantSettings: Record<string, unknown> | null
  menuCategories: ThemeEditorPreviewCategory[]
  menuItems: ThemeEditorPreviewItem[]
  compact?: boolean
}

const FALLBACK_CATEGORIES: MenuCategory[] = [
  { id: 'preview-breakfast', restaurant_id: 'preview', name: 'Kahvaltı', position: 0, is_visible: true, parent_id: null },
  { id: 'preview-coffee', restaurant_id: 'preview', name: 'Kahveler', position: 1, is_visible: true, parent_id: null },
  { id: 'preview-dessert', restaurant_id: 'preview', name: 'Tatlılar', position: 2, is_visible: true, parent_id: null },
]

function previewPrice(item: MenuItem | undefined, fallback: number) {
  const price = Number(item?.price)
  return Number.isFinite(price) && price > 0 ? price : fallback
}

/**
 * The section catalogue must explain the slider before a restaurant has
 * configured a campaign. These records are catalogue-only and never enter
 * the saved theme or the public menu data flow.
 */
function buildPromoSliderCatalogMock(items: MenuItem[]): PromoSliderCampaign[] {
  const first = items[0]
  const second = items[1] ?? first
  const firstPrice = previewPrice(first, 180)
  const secondPrice = previewPrice(second, 235)
  const firstImage = first?.images[0] ?? ''
  const secondImage = second?.images[0] ?? firstImage

  return [
    {
      id: 'catalog-daily-special',
      sectionInstanceId: 'catalog-daily-special',
      kind: 'daily-special',
      sourceLabel: 'Günün Özeli',
      title: first?.name ?? 'Günün favorisi',
      subtitle: first?.description || 'Bugün öne çıkan lezzet.',
      badge: 'GÜNÜN ÖZELİ',
      imageUrl: firstImage,
      price: Math.max(1, Math.round(firstPrice * 0.8)),
      oldPrice: firstPrice,
      backgroundColor: 'var(--p-card)',
      accentColor: 'var(--p-accent)',
      textColor: 'var(--p-text)',
      allergens: first ? getDefiniteAllergens(first) : [],
      hasCrossContact: Boolean(first && (first.may_contain_allergens.length > 0 || first.cross_contact_note)),
    },
    {
      id: 'catalog-discount',
      sectionInstanceId: 'catalog-discount',
      kind: 'discount-badge',
      sourceLabel: 'Menüye Özel',
      title: second?.name ?? 'Seçili üründe avantaj',
      subtitle: second?.description || 'Seçili üründe menüye özel fırsat.',
      badge: '%20 AVANTAJ',
      imageUrl: secondImage,
      price: Math.max(1, Math.round(secondPrice * 0.8)),
      oldPrice: secondPrice,
      backgroundColor: 'var(--p-accent-soft)',
      accentColor: 'var(--p-accent)',
      textColor: 'var(--p-text)',
      allergens: second ? getDefiniteAllergens(second) : [],
      hasCrossContact: Boolean(second && (second.may_contain_allergens.length > 0 || second.cross_contact_note)),
    },
    {
      id: 'catalog-combo',
      sectionInstanceId: 'catalog-combo',
      kind: 'combo-ribbon',
      sourceLabel: 'Kombo Şerit',
      title: `${first?.name ?? 'Kahve'} + ${second?.name ?? 'Tatlı'}`,
      subtitle: 'İki ürün birlikte, menüye özel fiyatla.',
      badge: '2 ÜRÜN',
      imageUrl: firstImage || secondImage,
      price: Math.max(1, Math.round((firstPrice + secondPrice) * 0.85)),
      oldPrice: firstPrice + secondPrice,
      backgroundColor: 'var(--p-card)',
      accentColor: 'var(--p-button)',
      textColor: 'var(--p-text)',
      allergens: sortAllergenCodes([...(first ? getDefiniteAllergens(first) : []), ...(second ? getDefiniteAllergens(second) : [])]),
      hasCrossContact: Boolean([first, second].some((item) => item && (item.may_contain_allergens.length > 0 || item.cross_contact_note))),
    },
  ]
}

/** The section catalogue renders the exact component used by the public menu. */
export function CanonicalSectionPreview({
  surface = 'menu',
  sectionId,
  theme,
  restaurantName,
  restaurantSettings,
  menuCategories,
  menuItems,
  compact = false,
}: CanonicalSectionPreviewProps) {
  const categories: MenuCategory[] = menuCategories.length > 0
    ? menuCategories.slice(0, 6).map((category, index) => ({
        id: category.id,
        restaurant_id: 'preview',
        name: category.name,
        position: index,
        is_visible: true,
        image_url: category.imageUrl ?? null,
        parent_id: category.parentId ?? null,
      }))
    : FALLBACK_CATEGORIES
  const itemDrivenSection = sectionId === 'daily-special'
    || sectionId === 'discount-badge'
    || sectionId === 'chef-pick'
    || sectionId === 'featured-scroll'
    || sectionId === 'combo-ribbon'
    || sectionId === 'promo-slider'
  const items: MenuItem[] = itemDrivenSection
    ? menuItems.filter((item) => item.isAvailable).map((item) => ({
      id: item.id,
      category_id: item.categoryId,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      images: Array.isArray(item.images)
        ? item.images.filter((image): image is string => typeof image === 'string')
        : [],
      ingredients: normalizeIngredients(item.ingredients),
      energy_kcal: item.energyKcal,
      contains_allergens: normalizeAllergenCodes(item.containsAllergens),
      may_contain_allergens: normalizeAllergenCodes(item.mayContainAllergens),
      allergen_note: item.allergenNote,
      cross_contact_note: item.crossContactNote,
      contains_alcohol: item.containsAlcohol,
      contains_pork: item.containsPork,
      is_vegetarian: item.isVegetarian,
      is_vegan: item.isVegan,
      is_halal: item.isHalal,
      food_info_reviewed_at: item.foodInfoReviewedAt,
      modifier_groups: normalizeModifierGroups(item.modifierGroups),
      is_available: item.isAvailable,
      position: item.position,
    }))
    : []
  const themeVars = computeThemeVars(theme) as CSSProperties
  const config = theme.sectionSettings?.[sectionId] ?? {}
  const pageBlocks = theme.pageBlocks?.length
    ? theme.pageBlocks
    : (theme.sections ?? []).map((id) => ({ type: 'section' as const, id }))
  const derivedActiveCampaigns = sectionId === 'promo-slider'
    ? deriveActivePromoSliderCampaigns({
        pageBlocks,
        sectionSettings: theme.sectionSettings ?? {},
        items,
      })
    : []
  const usesPromoSliderCatalogMock = sectionId === 'promo-slider' && derivedActiveCampaigns.length === 0
  const usesGalleryCatalogMock = sectionId === 'gallery' && !Object.entries(config).some(([key, value]) =>
    /^tile[1-6]Image$/.test(key) && Boolean(value.trim()),
  )
  const activeCampaigns = usesPromoSliderCatalogMock
    ? buildPromoSliderCatalogMock(items)
    : derivedActiveCampaigns
  const previewConfig = usesPromoSliderCatalogMock
    ? {
        ...config,
        sourceMode: 'active',
        activeCampaignIds: '',
        autoplay: 'false',
        indicator: 'dots',
      }
    : usesGalleryCatalogMock
      ? {
          ...config,
          catalogMock: 'true',
          showTitle: 'true',
          showBody: 'true',
          showLabels: 'true',
        }
      : config
  const usesStoreInfo = sectionId === 'hours'
  const storeInfo = usesStoreInfo ? readStoreInfo(restaurantSettings) : null
  const frameRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(compact ? 0.4 : 0.62)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return

    const updateScale = () => {
      const availableWidth = Math.max(1, frame.clientWidth - (compact ? 12 : 20))
      const availableHeight = Math.max(1, frame.clientHeight - (compact ? 12 : 20))
      const contentWidth = Math.max(1, content.offsetWidth)
      const contentHeight = Math.max(1, content.scrollHeight)
      const nextScale = Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight)
      setFitScale((current) => Math.abs(current - nextScale) < 0.005 ? current : nextScale)
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(frame)
    observer.observe(content)
    return () => observer.disconnect()
  }, [compact, sectionId])

  return (
    <div
      ref={frameRef}
      aria-label={`${sectionId} canlı menü önizlemesi`}
      style={{
        ...themeVars,
        width: '100%',
        height: compact ? 96 : 210,
        overflow: 'hidden',
        borderRadius: compact ? 10 : 14,
        background: 'var(--p-bg)',
        color: 'var(--p-text)',
        fontFamily: 'var(--p-body)',
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 390,
          transform: `translate(-50%, -50%) scale(${fitScale})`,
          transformOrigin: 'center',
        }}
      >
        <CustomSectionRenderer
          renderContext={surface === 'home' ? 'home' : 'catalog'}
          menuHref="/preview/menu"
          sectionId={sectionId}
          config={previewConfig}
          theme={theme}
          categories={categories}
          restaurantName={restaurantName}
          items={items}
          activeCampaigns={activeCampaigns}
          {...(itemDrivenSection ? { onQuickAdd: () => undefined } : {})}
          storeInfo={storeInfo}
          {...(theme.pageDescription ? { pageDescription: theme.pageDescription } : {})}
        />
      </div>
    </div>
  )
}
