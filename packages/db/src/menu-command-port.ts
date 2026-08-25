import type {
  MenuCategoryDraft,
  MenuCommandPort,
  MenuItemDraft,
  MenuItemPolicyState,
  PreparedMenuItemPatch,
} from '@garsonless/application/menu'
import { err, ok, type Result } from '@garsonless/domain'
import { createServiceClient } from './service-client'
import type { Json, Tables, TablesInsert, TablesUpdate } from './types.gen'

type MenuItem = Tables<'menu_items'>

async function categoryExists(restaurantId: string, categoryId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from('menu_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  return !error && !!data
}

async function itemExists(restaurantId: string, itemId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from('menu_items')
    .select('category_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return false
  return categoryExists(restaurantId, data.category_id)
}

async function stationExists(
  restaurantId: string,
  stationId: string | null | undefined,
): Promise<boolean> {
  if (stationId == null) return true
  const { data, error } = await createServiceClient()
    .from('kitchen_stations')
    .select('id')
    .eq('id', stationId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  return !error && !!data
}

async function categoryPosition(input: MenuCategoryDraft): Promise<number> {
  let query = createServiceClient()
    .from('menu_categories')
    .select('position')
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
  query = input.parentId
    ? query.eq('parent_id', input.parentId)
    : query.eq('restaurant_id', input.restaurantId).is('parent_id', null)
  const { data } = await query.maybeSingle()
  return (data?.position ?? -1) + 1
}

async function itemPosition(categoryId: string): Promise<number> {
  const { data } = await createServiceClient()
    .from('menu_items')
    .select('position')
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.position ?? -1) + 1
}

async function callMenuRpc(
  name: 'delete_menu_category' | 'reorder_menu_categories' | 'set_menu_items_availability',
  args: Record<string, string | string[] | boolean>,
): Promise<Result<null>> {
  const service = createServiceClient()
  const rpc = service.rpc.bind(service) as unknown as (
    functionName: string,
    parameters: Record<string, string | string[] | boolean>,
  ) => Promise<{ error: { message: string } | null }>
  const { error } = await rpc(name, args)
  return error ? err(error.message) : ok(null)
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function itemInsert(
  input: MenuItemDraft & { reviewedBy: string },
  position: number,
): TablesInsert<'menu_items'> {
  return {
    category_id: input.categoryId,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    vat_rate: input.vat_rate ?? null,
    kitchen_station_id: input.kitchen_station_id ?? null,
    cost: input.cost ?? null,
    is_available: input.is_available,
    earns_stamp: input.earns_stamp ?? false,
    ingredients: (input.ingredients ?? []) as Json,
    energy_kcal: input.energy_kcal ?? null,
    protein_g: input.protein_g ?? null,
    carb_g: input.carb_g ?? null,
    fat_g: input.fat_g ?? null,
    may_contain_allergens: stringList(input.may_contain_allergens),
    contains_allergens: stringList(input.contains_allergens),
    allergen_note: input.allergen_note ?? null,
    cross_contact_note: input.cross_contact_note ?? null,
    contains_alcohol: input.contains_alcohol ?? false,
    contains_pork: input.contains_pork ?? false,
    is_vegetarian: input.is_vegetarian ?? false,
    is_vegan: input.is_vegan ?? false,
    is_halal: input.is_halal ?? false,
    food_info_reviewed_at: input.food_info_reviewed ? new Date().toISOString() : null,
    food_info_reviewed_by: input.food_info_reviewed ? input.reviewedBy : null,
    modifier_groups: (input.modifier_groups ?? []) as Json,
    images: (input.images ?? []) as Json,
    position,
  }
}

function itemUpdate(input: PreparedMenuItemPatch): TablesUpdate<'menu_items'> {
  const {
    id: _id,
    restaurantId: _restaurantId,
    categoryId,
    modifier_groups,
    images,
    ingredients,
    contains_allergens,
    may_contain_allergens,
    ...rest
  } = input
  return {
    ...rest,
    ...(categoryId !== undefined ? { category_id: categoryId } : {}),
    ...(modifier_groups !== undefined ? { modifier_groups: modifier_groups as Json } : {}),
    ...(images !== undefined ? { images: images as Json } : {}),
    ...(ingredients !== undefined ? { ingredients: ingredients as Json } : {}),
    ...(contains_allergens !== undefined ? { contains_allergens: stringList(contains_allergens) } : {}),
    ...(may_contain_allergens !== undefined ? { may_contain_allergens: stringList(may_contain_allergens) } : {}),
  } as TablesUpdate<'menu_items'>
}

export function createMenuCommandPort(): MenuCommandPort<MenuItem> {
  return {
    async createCategory(input) {
      if (input.parentId && !(await categoryExists(input.restaurantId, input.parentId))) {
        return err('Invalid parent category')
      }
      if (!(await stationExists(input.restaurantId, input.kitchen_station_id))) {
        return err('Invalid kitchen station')
      }
      const { data, error } = await createServiceClient()
        .from('menu_categories')
        .insert({
          restaurant_id: input.restaurantId,
          name: input.name,
          description: input.description ?? null,
          image_url: input.image_url ?? null,
          vat_rate: input.vat_rate ?? 10,
          kitchen_station_id: input.kitchen_station_id ?? null,
          position: await categoryPosition(input),
          parent_id: input.parentId ?? null,
        })
        .select('id')
        .single()
      if (error) return err(error.message)
      return data?.id ? ok({ id: data.id }) : err('Failed to create category')
    },

    async updateCategory(input) {
      if (!(await categoryExists(input.restaurantId, input.id))) return err('Category not found')
      if (!(await stationExists(input.restaurantId, input.kitchen_station_id))) {
        return err('Invalid kitchen station')
      }
      const { id, restaurantId, ...updates } = input
      const { error } = await createServiceClient()
        .from('menu_categories')
        .update(updates)
        .eq('id', id)
        .eq('restaurant_id', restaurantId)
      return error ? err(error.message) : ok(null)
    },

    deleteCategory(input) {
      return callMenuRpc('delete_menu_category', {
        p_category_id: input.categoryId,
        p_restaurant_id: input.restaurantId,
      })
    },

    reorderCategories(input) {
      return callMenuRpc('reorder_menu_categories', {
        p_ordered_ids: input.orderedIds,
        p_restaurant_id: input.restaurantId,
      })
    },

    async createItem(input) {
      if (!(await categoryExists(input.restaurantId, input.categoryId))) return err('Invalid category')
      if (!(await stationExists(input.restaurantId, input.kitchen_station_id))) {
        return err('Invalid kitchen station')
      }
      const { data, error } = await createServiceClient()
        .from('menu_items')
        .insert(itemInsert(input, await itemPosition(input.categoryId)))
        .select('*')
        .single()
      if (error) return err(error.message)
      return data ? ok(data) : err('Failed to create item')
    },

    async readItemPolicyState(input) {
      if (!(await itemExists(input.restaurantId, input.itemId))) return err('Item not found')
      const { data, error } = await createServiceClient()
        .from('menu_items')
        .select('is_vegetarian, is_vegan, is_halal, contains_alcohol, contains_pork, contains_allergens, may_contain_allergens')
        .eq('id', input.itemId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error || !data) return err('Item not found')
      return ok(data as MenuItemPolicyState)
    },

    async updateItem(input) {
      if (!(await itemExists(input.restaurantId, input.id))) return err('Item not found')
      if (input.categoryId && !(await categoryExists(input.restaurantId, input.categoryId))) {
        return err('Invalid category')
      }
      if (!(await stationExists(input.restaurantId, input.kitchen_station_id))) {
        return err('Invalid kitchen station')
      }
      const { data, error } = await createServiceClient()
        .from('menu_items')
        .update(itemUpdate(input))
        .eq('id', input.id)
        .select('*')
        .maybeSingle()
      if (error) return err(error.message)
      return data ? ok(data) : err('Item not found')
    },

    async deleteItem(input) {
      if (!(await itemExists(input.restaurantId, input.itemId))) return err('Item not found')
      const { error } = await createServiceClient()
        .from('menu_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', input.itemId)
      return error ? err(error.message) : ok(null)
    },

    setItemsAvailability(input) {
      return callMenuRpc('set_menu_items_availability', {
        p_restaurant_id: input.restaurantId,
        p_item_ids: input.itemIds,
        p_is_available: input.isAvailable,
      })
    },
  }
}
