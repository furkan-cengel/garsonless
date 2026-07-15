import { createClient } from '@garsonless/db'
import type { Tables } from '@garsonless/db'
import type { MenuItem, MenuCategory } from '@garsonless/ui'
import {
  normalizeAllergenCodes,
  normalizeIngredients,
  normalizeModifierGroups,
} from '@garsonless/db/order-client'

type PublicMenuItemRow = Pick<
  Tables<'menu_items'>,
  | 'id'
  | 'category_id'
  | 'name'
  | 'description'
  | 'price'
  | 'images'
  | 'ingredients'
  | 'energy_kcal'
  | 'contains_allergens'
  | 'may_contain_allergens'
  | 'allergen_note'
  | 'cross_contact_note'
  | 'contains_alcohol'
  | 'contains_pork'
  | 'is_vegetarian'
  | 'is_vegan'
  | 'is_halal'
  | 'food_info_reviewed_at'
  | 'modifier_groups'
  | 'is_available'
  | 'position'
>

function mapCategory(row: Tables<'menu_categories'>): MenuCategory {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    position: row.position,
    is_visible: row.is_visible,
    image_url: row.image_url,
    parent_id: row.parent_id,
  }
}

function mapMenuItem(row: PublicMenuItemRow): MenuItem {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    ingredients: normalizeIngredients(row.ingredients),
    energy_kcal: row.energy_kcal ?? null,
    contains_allergens: normalizeAllergenCodes(row.contains_allergens),
    may_contain_allergens: normalizeAllergenCodes(row.may_contain_allergens),
    allergen_note: row.allergen_note ?? null,
    cross_contact_note: row.cross_contact_note ?? null,
    contains_alcohol: row.contains_alcohol ?? false,
    contains_pork: row.contains_pork ?? false,
    is_vegetarian: row.is_vegetarian ?? false,
    is_vegan: row.is_vegan ?? false,
    is_halal: row.is_halal ?? false,
    food_info_reviewed_at: row.food_info_reviewed_at ?? null,
    modifier_groups: normalizeModifierGroups(row.modifier_groups),
    is_available: row.is_available,
    position: row.position,
  }
}

export async function getRestaurantBySlug(slug: string): Promise<Tables<'restaurants'> | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  return data as Tables<'restaurants'> | null
}

export interface TableSessionInfo {
  id: string
  openedAt: string
}

export interface SessionOrderRow {
  id: string
  status: string
  total: number
  paidAt: string | null
  createdAt: string
  itemCount: number
}

export async function getThemeConfig(
  restaurantId: string,
): Promise<Tables<'theme_configs'> | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('theme_configs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single()
  return data as Tables<'theme_configs'> | null
}

export async function getMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_visible', true)
    .is('deleted_at', null)
    .order('position')
  return (data ?? []).map(mapCategory)
}

export async function getMenuItems(categoryIds: string[]): Promise<MenuItem[]> {
  if (categoryIds.length === 0) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('menu_items')
    .select(`
      id,
      category_id,
      name,
      description,
      price,
      images,
      ingredients,
      energy_kcal,
      contains_allergens,
      may_contain_allergens,
      allergen_note,
      cross_contact_note,
      contains_alcohol,
      contains_pork,
      is_vegetarian,
      is_vegan,
      is_halal,
      food_info_reviewed_at,
      modifier_groups,
      is_available,
      position
    `)
    .in('category_id', categoryIds)
    .eq('is_available', true)
    .is('deleted_at', null)
    .order('position')
  return (data ?? []).map(mapMenuItem)
}
