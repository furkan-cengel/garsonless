import type {
  AllergenCode,
  MenuIngredient,
  MenuModifierGroup,
  SelectedMenuModifier,
} from '@garsonless/db/browser'

export type ModifierGroup = MenuModifierGroup
export type SelectedModifier = SelectedMenuModifier
export type { AllergenCode }

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  images: string[]
  ingredients: MenuIngredient[]
  energy_kcal: number | null
  contains_allergens: AllergenCode[]
  may_contain_allergens: AllergenCode[]
  allergen_note: string | null
  cross_contact_note: string | null
  contains_alcohol: boolean
  contains_pork: boolean
  is_vegetarian: boolean
  is_vegan: boolean
  is_halal: boolean
  food_info_reviewed_at: string | null
  modifier_groups: ModifierGroup[]
  is_available: boolean
  position: number
  /** Manually ordered product ids shown in the product-detail upsell. */
  recommended_item_ids?: string[]
  /** Server-derived ranking used only by the automatic Featured section. */
  featuredRank?: number
  featuredSalesQuantity?: number
  featuredSalesSource?: 'today' | 'previous-day'
  /** Published 3D model; present only for AR-enabled restaurants. */
  ar?: MenuItemAr
}

interface MenuItemAr {
  versionId: string
  glbUrl: string
  usdzUrl: string | null
  posterUrl: string | null
  widthMm: number | null
  depthMm: number | null
  heightMm: number | null
  portionNote: string | null
}

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  position: number
  is_visible: boolean
  image_url?: string | null
  parent_id?: string | null
}

/**
 * Identifies a promotion rendered by a published custom section. The client
 * only carries the section identity; the server re-resolves the product and
 * price from the published theme before accepting an order.
 */
export interface SectionPromotionContext {
  sectionInstanceId: string
  kind: 'discount-badge' | 'daily-special' | 'promo-slider'
  /** Client-side cart controls advance in this many units. The server derives
   * and validates the authoritative step from the published section. */
  quantityStep?: number
  /** Functional promo-slider offer identity. Omitted by legacy campaigns. */
  offer?: 'freebie'
  /** Pairs the paid qualifier and the free reward inside one cart operation. */
  instanceId?: string
  role?: 'qualifier' | 'reward'
}

export interface CartItem {
  cartId: string
  itemId: string
  name: string
  price: number
  quantity: number
  modifiers: SelectedModifier[]
  modifiersPriceDelta: number
  modifierNames: string[]
  removedIngredientIds: string[]
  removedIngredientNames: string[]
  productNote?: string
  recommendationSourceItemId?: string
  energyKcal: number | null
  imageUrl: string | null
  originalPrice?: number
  combo?: {
    instanceId: string
    sectionInstanceId: string
    comboIndex: number
  }
  promotion?: SectionPromotionContext
}
