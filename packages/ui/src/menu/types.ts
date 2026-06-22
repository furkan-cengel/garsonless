export interface ModifierOption {
  id: string
  name: string
  price_delta: number
  is_default: boolean
}

export interface ModifierGroup {
  id: string
  name: string
  type: 'required' | 'optional' | 'quantity'
  min: number
  max: number
  options: ModifierOption[]
}

export interface SelectedModifier {
  group_id: string
  option_id: string
  quantity?: number
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  images: string[]
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
  imageUrl: string | null
  originalPrice?: number
}
