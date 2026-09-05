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
import { PUBLIC_MENU_CACHE_SECONDS, publicMenuCacheKey } from './public-menu-cache-policy'
import { readPublicRestaurantWithRpcFallback } from './public-restaurant-rollout'
import { getPublicMenuRevision } from './public-menu-revision'
import { loadMenuCatalog } from './menu-catalog-loader'

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
  const normalizedSlug = slug.trim()
  const { data, error, source } = await readPublicRestaurantWithRpcFallback<PublicRestaurant>(
    async () => {
      const result = await supabase
        .rpc('read_public_restaurant_by_slug', { p_slug: slug })
        .maybeSingle()
      return { data: result.data as PublicRestaurant | null, error: result.error }
    },
    async () => {
      const result = await supabase
        .from('restaurants')
        .select('id, name, slug, logo_url, settings, timezone')
        .eq('slug', normalizedSlug)
        .is('deleted_at', null)
        .maybeSingle()
      return { data: result.data as PublicRestaurant | null, error: result.error }
    },
  )
  assertNoMenuQueryError(
    source === 'rpc' ? 'read_public_restaurant_by_slug' : 'restaurants.select.rpc-rollout-fallback',
    error,
  )
  return data as PublicRestaurant | null
}

// This small lookup deliberately remains request-scoped. Restaurant identity
// and slug changes happen in the Dashboard application, whose Next cache is a
// different deployment and cannot invalidate this process reliably.
export const getRestaurantBySlug = cache(readRestaurantBySlug)

// Theme previews must reflect branding writes immediately. The dashboard and
// menu are separate Next.js applications, so a dashboard-side cache
// invalidation cannot reliably evict this app's data cache. Keep the cached
// reader for public traffic, but deliberately bypass it for preview requests.
export function getPreviewRestaurantBySlug(slug: string): Promise<PublicRestaurant | null> {
  return readRestaurantBySlug(slug)
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

export function getMenuCategories(restaurantId: string, revision: number): Promise<MenuCategory[]> {
  return unstable_cache(
    () => readMenuCategories(restaurantId),
    publicMenuCacheKey('categories', restaurantId, revision),
    { revalidate: PUBLIC_MENU_CACHE_SECONDS },
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
  revision: number,
  categoryIds: string[],
): Promise<MenuItem[]> {
  return unstable_cache(
    () => readMenuItems(categoryIds),
    [...publicMenuCacheKey('items', restaurantId, revision), ...categoryIds],
    { revalidate: PUBLIC_MENU_CACHE_SECONDS },
  )()
}

export function getMenuCatalog(restaurantId: string, revision?: number) {
  return loadMenuCatalog(restaurantId, {
    readRevision: () => revision === undefined
      ? getPublicMenuRevision(restaurantId)
      : Promise.resolve({ revision }),
    readCategories: getMenuCategories,
    readItems: getMenuItems,
  })
}
