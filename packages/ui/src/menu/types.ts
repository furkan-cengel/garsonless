import type {
  AllergenCode,
  MenuIngredient,
  MenuModifierGroup,
  MenuModifierOption,
  SelectedMenuModifier,
} from '@garsonless/db/order-client'

export type ModifierOption = MenuModifierOption
export type ModifierGroup = MenuModifierGroup
export type SelectedModifier = SelectedMenuModifier
export type { AllergenCode, MenuIngredient }

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  images: string[]
  ingredients: MenuIngredient[]
  energy_kcal: number | null
  may_contain_allergens: AllergenCode[]
  contains_alcohol: boolean
  contains_pork: boolean
  food_info_reviewed_at: string | null
  modifier_groups: ModifierGroup[]
  is_available: boolean
  position: number
}

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  position: number
  is_visible: boolean
  parent_id?: string | null
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
  energyKcal: number | null
  imageUrl: string | null
  originalPrice?: number
}
