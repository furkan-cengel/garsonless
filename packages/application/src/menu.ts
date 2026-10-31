import type { DashboardActorContext, Result } from '@garsonless/domain'
import {
  err,
  getDietaryClaimsConflict,
  hasSameRestaurant,
  ok,
  separateAllergenDeclarations,
} from '@garsonless/domain'
import { authorizeDashboardFeatureRead } from './dashboard-feature-read-models'

export interface MenuCategoryDraft {
  restaurantId: string
  name: string
  description?: string | null
  image_url?: string | null
  parentId?: string
  vat_rate?: number
  kitchen_station_id?: string | null
}

export interface MenuCategoryPatch extends Omit<MenuCategoryDraft, 'name'> {
  id: string
  name?: string
  position?: number
}

export interface MenuItemDraft {
  restaurantId: string
  categoryId: string
  name: string
  description?: string | null
  price: number
  vat_rate?: number | null
  kitchen_station_id?: string | null
  cost?: number | null
  is_available: boolean
  earns_stamp?: boolean
  ingredients?: unknown
  energy_kcal?: number | null
  protein_g?: number | null
  carb_g?: number | null
  fat_g?: number | null
  may_contain_allergens?: unknown
  contains_allergens?: unknown
  allergen_note?: string | null
  cross_contact_note?: string | null
  contains_alcohol?: boolean
  contains_pork?: boolean
  is_vegetarian?: boolean
  is_vegan?: boolean
  is_halal?: boolean
  food_info_reviewed?: boolean
  modifier_groups?: unknown
  images?: unknown
}

export interface MenuItemPatch extends Partial<Omit<MenuItemDraft, 'restaurantId'>> {
  expectedUpdatedAt: string
  id: string
  restaurantId: string
}

export interface MenuItemPolicyState {
  is_vegetarian: boolean
  is_vegan: boolean
  is_halal: boolean
  contains_alcohol: boolean
  contains_pork: boolean
  contains_allergens: unknown
  may_contain_allergens: unknown
}

export interface PreparedMenuItemPatch extends Omit<MenuItemPatch, 'food_info_reviewed'> {
  food_info_reviewed_at?: string | null
  food_info_reviewed_by?: string | null
}

export interface MenuCommandPort<TItem> {
  createCategory(input: MenuCategoryDraft): Promise<Result<{ id: string }>>
  updateCategory(input: MenuCategoryPatch): Promise<Result<null>>
  deleteCategory(input: { restaurantId: string; categoryId: string }): Promise<Result<null>>
  reorderCategories(input: { restaurantId: string; orderedIds: string[] }): Promise<Result<null>>
  reorderItems(input: { restaurantId: string; categoryId: string; orderedIds: string[] }): Promise<Result<null>>
  createItem(input: MenuItemDraft & { reviewedBy: string }): Promise<Result<TItem>>
  readItemPolicyState(input: { restaurantId: string; itemId: string }): Promise<Result<MenuItemPolicyState>>
  updateItem(input: PreparedMenuItemPatch): Promise<Result<TItem>>
  deleteItem(input: { restaurantId: string; itemId: string }): Promise<Result<null>>
  /** Ids among `itemIds` that appear on at least one order of this restaurant. */
  findItemsWithOrderHistory(input: { restaurantId: string; itemIds: string[] }): Promise<Result<string[]>>
  setItemsAvailability(input: {
    restaurantId: string
    itemIds: string[]
    isAvailable: boolean
  }): Promise<Result<null>>
}

export interface MenuManagementReadModel<TCategory, TItem, TStation> {
  categories: TCategory[]
  items: TItem[]
  kitchenStations: TStation[]
}

export interface MenuManagementReadModelPort<TCategory, TItem, TStation> {
  readManagementData(input: { restaurantId: string; operation: 'menu.management' }): Promise<Result<MenuManagementReadModel<TCategory, TItem, TStation>>>
  readKitchenStations(input: { restaurantId: string; operation: 'menu.kitchen-stations' }): Promise<Result<TStation[]>>
}

function requireMenuAccess(context: DashboardActorContext, restaurantId: string): Result<true> {
  if (!hasSameRestaurant(context, restaurantId) || !context.permissions.includes('menu')) {
    return err('Not authorized')
  }
  return ok(true)
}

export async function readMenuManagement<TCategory, TItem, TStation>(
  context: DashboardActorContext,
  restaurantId: string,
  port: MenuManagementReadModelPort<TCategory, TItem, TStation>,
): Promise<Result<MenuManagementReadModel<TCategory, TItem, TStation>>> {
  const access = authorizeDashboardFeatureRead(context, restaurantId, 'menu.management')
  return access.ok ? port.readManagementData({ restaurantId, operation: 'menu.management' }) : access
}

export async function readMenuKitchenStations<TCategory, TItem, TStation>(
  context: DashboardActorContext,
  restaurantId: string,
  port: MenuManagementReadModelPort<TCategory, TItem, TStation>,
): Promise<Result<TStation[]>> {
  const access = authorizeDashboardFeatureRead(context, restaurantId, 'menu.kitchen-stations')
  return access.ok
    ? port.readKitchenStations({ restaurantId, operation: 'menu.kitchen-stations' })
    : access
}

function dietaryConflict(input: Partial<MenuItemDraft>, current?: MenuItemPolicyState): string | null {
  return getDietaryClaimsConflict({
    vegetarian: input.is_vegetarian ?? current?.is_vegetarian ?? false,
    vegan: input.is_vegan ?? current?.is_vegan ?? false,
    halal: input.is_halal ?? current?.is_halal ?? false,
    containsAlcohol: input.contains_alcohol ?? current?.contains_alcohol ?? false,
    containsPork: input.contains_pork ?? current?.contains_pork ?? false,
  })
}

function hasFoodInfoChange(input: MenuItemPatch): boolean {
  return [
    'ingredients',
    'energy_kcal',
    'protein_g',
    'carb_g',
    'fat_g',
    'contains_allergens',
    'allergen_note',
    'cross_contact_note',
    'may_contain_allergens',
    'contains_alcohol',
    'contains_pork',
    'is_vegetarian',
    'is_vegan',
    'is_halal',
    'modifier_groups',
  ].some((key) => Object.prototype.hasOwnProperty.call(input, key))
}

export async function createMenuCategory<TItem>(
  context: DashboardActorContext,
  input: MenuCategoryDraft,
  port: MenuCommandPort<TItem>,
): Promise<Result<{ id: string }>> {
  const access = requireMenuAccess(context, input.restaurantId)
  return access.ok ? port.createCategory(input) : access
}

export async function updateMenuCategory<TItem>(
  context: DashboardActorContext,
  input: MenuCategoryPatch,
  port: MenuCommandPort<TItem>,
): Promise<Result<null>> {
  const access = requireMenuAccess(context, input.restaurantId)
  return access.ok ? port.updateCategory(input) : access
}

export async function deleteMenuCategory<TItem>(
  context: DashboardActorContext,
  input: { restaurantId: string; categoryId: string },
  port: MenuCommandPort<TItem>,
): Promise<Result<null>> {
  const access = requireMenuAccess(context, input.restaurantId)
  return access.ok ? port.deleteCategory(input) : access
}

export async function reorderMenuCategories<TItem>(
  context: DashboardActorContext,
  input: { restaurantId: string; orderedIds: string[] },
  port: MenuCommandPort<TItem>,
): Promise<Result<null>> {
  const access = requireMenuAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (new Set(input.orderedIds).size !== input.orderedIds.length) return err('Invalid category order')
  return port.reorderCategories(input)
}

/** Manual product order inside one category; the list must name every live product once. */
export async function reorderMenuItems<TItem>(
  context: DashboardActorContext,
  input: { restaurantId: string; categoryId: string; orderedIds: string[] },
  port: MenuCommandPort<TItem>,
): Promise<Result<null>> {
  const access = requireMenuAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (input.orderedIds.length === 0 || input.orderedIds.length > 500) return err('Invalid item order')
  if (new Set(input.orderedIds).size !== input.orderedIds.length) return err('Invalid item order')
  return port.reorderItems(input)
}

export async function createMenuItem<TItem>(
  context: DashboardActorContext,
  input: MenuItemDraft,
  port: MenuCommandPort<TItem>,
): Promise<Result<TItem>> {
  const access = requireMenuAccess(context, input.restaurantId)
  if (!access.ok) return access
  const conflict = dietaryConflict(input)
  if (conflict) return err(conflict)
  const allergens = separateAllergenDeclarations(input.contains_allergens, input.may_contain_allergens)
  return port.createItem({
    ...input,
    contains_allergens: allergens.contains,
    may_contain_allergens: allergens.traces,
    reviewedBy: context.userId,
  })
}

export async function updateMenuItem<TItem>(
  context: DashboardActorContext,
  input: MenuItemPatch,
  port: MenuCommandPort<TItem>,
  now = new Date(),
): Promise<Result<TItem>> {
  const access = requireMenuAccess(context, input.restaurantId)
  if (!access.ok) return access

  const existing = await port.readItemPolicyState({
    restaurantId: input.restaurantId,
    itemId: input.id,
  })
  if (!existing.ok) return existing

  const conflict = dietaryConflict(input, existing.value)
  if (conflict) return err(conflict)

  const { food_info_reviewed, ...patchWithoutReview } = input
  const prepared: PreparedMenuItemPatch = patchWithoutReview
  if (
    Object.prototype.hasOwnProperty.call(input, 'contains_allergens')
    || Object.prototype.hasOwnProperty.call(input, 'may_contain_allergens')
  ) {
    const allergens = separateAllergenDeclarations(
      input.contains_allergens ?? existing.value.contains_allergens,
      input.may_contain_allergens ?? existing.value.may_contain_allergens,
    )
    prepared.contains_allergens = allergens.contains
    prepared.may_contain_allergens = allergens.traces
  }

  if (food_info_reviewed !== undefined || hasFoodInfoChange(input)) {
    prepared.food_info_reviewed_at = food_info_reviewed ? now.toISOString() : null
    prepared.food_info_reviewed_by = food_info_reviewed ? context.userId : null
  }

  return port.updateItem(prepared)
}

export async function deleteMenuItem<TItem>(
  context: DashboardActorContext,
  input: { restaurantId: string; itemId: string },
  port: MenuCommandPort<TItem>,
): Promise<Result<null>> {
  const access = requireMenuAccess(context, input.restaurantId)
  if (!access.ok) return access
  // Ordered products stay in reports and order history; they can only be set passive.
  const history = await port.findItemsWithOrderHistory({ restaurantId: input.restaurantId, itemIds: [input.itemId] })
  if (!history.ok) return history
  if (history.value.length > 0) return err('menu_item_has_orders')
  return port.deleteItem(input)
}

export async function listMenuItemsWithOrderHistory<TItem>(
  context: DashboardActorContext,
  input: { restaurantId: string; itemIds: string[] },
  port: MenuCommandPort<TItem>,
): Promise<Result<string[]>> {
  const access = requireMenuAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (input.itemIds.length === 0) return ok([])
  if (input.itemIds.length > 500 || new Set(input.itemIds).size !== input.itemIds.length) return err('Invalid item selection')
  return port.findItemsWithOrderHistory(input)
}

export async function setMenuItemsAvailability<TItem>(
  context: DashboardActorContext,
  input: { restaurantId: string; itemIds: string[]; isAvailable: boolean },
  port: MenuCommandPort<TItem>,
): Promise<Result<null>> {
  const access = requireMenuAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (input.itemIds.length === 0 || new Set(input.itemIds).size !== input.itemIds.length) {
    return err('Invalid item selection')
  }
  return port.setItemsAvailability(input)
}
