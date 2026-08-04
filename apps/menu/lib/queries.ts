import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import {
  createClient,
  normalizeAllergenCodes,
  normalizeIngredients,
  normalizeModifierGroups,
} from '@garsonless/db/browser'
import type { Tables } from '@garsonless/db/types'
import type { MenuItem, MenuCategory } from '@garsonless/ui/menu'

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

type PublicMenuCategoryRow = Pick<
  Tables<'menu_categories'>,
  'id' | 'restaurant_id' | 'name' | 'position' | 'is_visible' | 'image_url' | 'parent_id'
>

export type PublicRestaurant = Pick<
  Tables<'restaurants'>,
  'id' | 'name' | 'slug' | 'logo_url' | 'settings' | 'timezone'
>

function assertNoMenuQueryError(
  operation: string,
  error: { code?: string; message?: string } | null,
): void {
  if (!error) return
  // A failing public menu query is a deploy/grant bug, never "no products".
  // Log the structured cause server-side and fail visibly instead of
  // rendering an empty menu.
  console.error(`[menu-public-query] ${operation} failed`, {
    code: error.code ?? null,
    message: error.message ?? null,
  })
  throw new Error(`Menu data could not be loaded (${operation})`)
}

function mapCategory(row: PublicMenuCategoryRow): MenuCategory {
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

function mapMenuItem(row: PublicMenuItemRow, recommendedItemIds: string[] = []): MenuItem {
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
    recommended_item_ids: recommendedItemIds,
  }
}

async function readRestaurantBySlug(
  slug: string,
): Promise<PublicRestaurant | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo_url, settings, timezone')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()
  assertNoMenuQueryError('restaurants.select', error)
  return data as PublicRestaurant | null
}

export const getRestaurantBySlug = cache((slug: string) => unstable_cache(
  () => readRestaurantBySlug(slug),
  ['public-menu-restaurant-v1', slug],
  { revalidate: 60, tags: [`public-menu:${slug}`] },
)())

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

async function readMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('menu_categories')
    .select('id, restaurant_id, name, position, is_visible, image_url, parent_id')
    .eq('restaurant_id', restaurantId)
    .eq('is_visible', true)
    .is('deleted_at', null)
    .order('position')
  assertNoMenuQueryError('menu_categories.select', error)
  return (data ?? []).map(mapCategory)
}

export function getMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
  return unstable_cache(
    () => readMenuCategories(restaurantId),
    ['public-menu-categories-v1', restaurantId],
    { revalidate: 300, tags: [`menu:${restaurantId}`] },
  )()
}

async function readMenuItems(categoryIds: string[]): Promise<MenuItem[]> {
  if (categoryIds.length === 0) return []
  const supabase = createClient()
  const { data, error } = await supabase
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
  assertNoMenuQueryError('menu_items.select', error)
  const rows = (data ?? []) as PublicMenuItemRow[]
  const itemIds = rows.map((row) => row.id)
  const recommendationIdsBySource = new Map<string, string[]>()
  if (itemIds.length > 0) {
    const { data: recommendations, error: recommendationError } = await supabase
      .from('menu_item_recommendations')
      .select('source_item_id, recommended_item_id, position')
      .in('source_item_id', itemIds)
      .order('position')
    if (recommendationError?.code !== 'PGRST205') {
      assertNoMenuQueryError('menu_item_recommendations.select', recommendationError)
    }
    for (const recommendation of recommendations ?? []) {
      const ids = recommendationIdsBySource.get(recommendation.source_item_id) ?? []
      ids.push(recommendation.recommended_item_id)
      recommendationIdsBySource.set(recommendation.source_item_id, ids)
    }
  }
  return rows.map((row) => mapMenuItem(row, recommendationIdsBySource.get(row.id) ?? []))
}

export function getMenuItems(
  restaurantId: string,
  categoryIds: string[],
): Promise<MenuItem[]> {
  return unstable_cache(
    () => readMenuItems(categoryIds),
    ['public-menu-items-v1', restaurantId, ...categoryIds],
    { revalidate: 300, tags: [`menu:${restaurantId}`] },
  )()
}
