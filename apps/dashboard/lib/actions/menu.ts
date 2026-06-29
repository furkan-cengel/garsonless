'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { assertAccess } from '../auth/access'
import { ALLERGEN_CODES } from '@garsonless/db/order-client'

const categorySchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(300).nullable().optional(),
  parentId: z.string().uuid().optional(),
})

const categoryUpdateSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).nullable().optional(),
})

const modifierOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  price_delta: z.number().min(0),
  calorie_delta: z.number().int(),
  is_default: z.boolean(),
  allergen_codes: z.array(z.enum(ALLERGEN_CODES)),
})

const modifierGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  selection_mode: z.enum(['single', 'multiple', 'quantity']),
  required: z.boolean(),
  min: z.number().int().min(0),
  max: z.number().int().min(1),
  options: z.array(modifierOptionSchema),
}).refine((group) => group.max >= group.min, 'Maximum must be greater than minimum')

const ingredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  removable: z.boolean(),
  allergen_codes: z.array(z.enum(ALLERGEN_CODES)),
})

const itemSchema = z.object({
  categoryId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  price: z.number().min(0),
  is_available: z.boolean().default(true),
  earns_stamp: z.boolean().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  energy_kcal: z.number().int().min(0).nullable().optional(),
  may_contain_allergens: z.array(z.enum(ALLERGEN_CODES)).optional(),
  contains_alcohol: z.boolean().optional(),
  contains_pork: z.boolean().optional(),
  food_info_reviewed: z.boolean().optional(),
  modifier_groups: z.array(modifierGroupSchema).optional(),
})

const itemUpdateSchema = itemSchema.partial().extend({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  images: z.array(z.string()).optional(),
})

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// Phase 3 section gate: the owner OR a member with the 'menu' section may manage
// menu. Kept boolean-shaped so all call sites stay unchanged.
async function assertRestaurantOwner(
  _supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  _userId: string,
) {
  const gate = await assertAccess(restaurantId, 'menu')
  return !('error' in gate)
}

export async function createCategory(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = categorySchema.safeParse({
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name'),
    description: formData.get('description') ?? null,
    parentId: formData.get('parentId') ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  let posQuery = supabase
    .from('menu_categories')
    .select('position')
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
  if (parsed.data.parentId) {
    posQuery = posQuery.eq('parent_id', parsed.data.parentId)
  } else {
    posQuery = posQuery.eq('restaurant_id', parsed.data.restaurantId).is('parent_id', null)
  }
  const { data: maxPos } = await posQuery.maybeSingle()

  const position = ((maxPos as { position: number } | null)?.position ?? -1) + 1

  const { data, error } = await mut(supabase, 'menu_categories')
    .insert({
      restaurant_id: parsed.data.restaurantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      position,
      parent_id: parsed.data.parentId ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const id = (data as { id: string } | null)?.id
  if (!id) return { error: 'Failed to create category' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { id }
}

export async function updateCategory(
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get('id'),
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name') ?? undefined,
    description: formData.get('description'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { id, restaurantId: _r, ...updates } = parsed.data
  const { error } = await mut(supabase, 'menu_categories')
    .update(updates as Record<string, unknown>)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { success: true }
}

export async function deleteCategory(
  categoryId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const now = new Date().toISOString()

  const { data: subCats } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('parent_id', categoryId)
    .is('deleted_at', null)

  const subCatIds = (subCats ?? []).map(c => (c as { id: string }).id)

  await mut(supabase, 'menu_items')
    .update({ deleted_at: now })
    .eq('category_id', categoryId)
    .is('deleted_at', null)

  if (subCatIds.length > 0) {
    await Promise.all(subCatIds.map(subId =>
      mut(supabase, 'menu_items').update({ deleted_at: now }).eq('category_id', subId).is('deleted_at', null),
    ))
    await Promise.all(subCatIds.map(subId =>
      mut(supabase, 'menu_categories').update({ deleted_at: now }).eq('id', subId),
    ))
  }

  const { error } = await mut(supabase, 'menu_categories')
    .update({ deleted_at: now })
    .eq('id', categoryId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function reorderCategories(
  restaurantId: string,
  orderedIds: string[],
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  await Promise.all(
    orderedIds.map((id, position) =>
      mut(supabase, 'menu_categories').update({ position }).eq('id', id),
    ),
  )

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function createItem(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const modifierGroupsRaw = formData.get('modifier_groups')
  const ingredientsRaw = formData.get('ingredients')
  const mayContainRaw = formData.get('may_contain_allergens')
  const parsed = itemSchema.safeParse({
    categoryId: formData.get('categoryId'),
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name'),
    description: formData.get('description') ?? null,
    price: Number(formData.get('price')),
    is_available: formData.get('is_available') !== 'false',
    ingredients: ingredientsRaw ? JSON.parse(ingredientsRaw as string) : [],
    energy_kcal: formData.get('energy_kcal') ? Number(formData.get('energy_kcal')) : null,
    may_contain_allergens: mayContainRaw ? JSON.parse(mayContainRaw as string) : [],
    contains_alcohol: formData.get('contains_alcohol') === 'true',
    contains_pork: formData.get('contains_pork') === 'true',
    food_info_reviewed: formData.get('food_info_reviewed') === 'true',
    modifier_groups: modifierGroupsRaw ? JSON.parse(modifierGroupsRaw as string) : [],
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data: maxPos } = await supabase
    .from('menu_items')
    .select('position')
    .eq('category_id', parsed.data.categoryId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = ((maxPos as { position: number } | null)?.position ?? -1) + 1

  const { data, error } = await mut(supabase, 'menu_items')
    .insert({
      category_id: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      is_available: parsed.data.is_available,
      ingredients: (parsed.data.ingredients ?? []) as import('@garsonless/db').Json,
      energy_kcal: parsed.data.energy_kcal ?? null,
      may_contain_allergens: parsed.data.may_contain_allergens ?? [],
      contains_alcohol: parsed.data.contains_alcohol ?? false,
      contains_pork: parsed.data.contains_pork ?? false,
      food_info_reviewed_at: parsed.data.food_info_reviewed ? new Date().toISOString() : null,
      food_info_reviewed_by: parsed.data.food_info_reviewed ? user.id : null,
      modifier_groups: (parsed.data.modifier_groups ?? []) as import('@garsonless/db').Json,
      images: [] as import('@garsonless/db').Json,
      position,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const id = (data as { id: string } | null)?.id
  if (!id) return { error: 'Failed to create item' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { id }
}

export async function updateItem(
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const modifierGroupsRaw = formData.get('modifier_groups')
  const imagesRaw = formData.get('images')
  const ingredientsRaw = formData.get('ingredients')
  const mayContainRaw = formData.get('may_contain_allergens')
  const parsed = itemUpdateSchema.safeParse({
    id: formData.get('id'),
    restaurantId: formData.get('restaurantId'),
    categoryId: formData.get('categoryId') ?? undefined,
    name: formData.get('name') ?? undefined,
    description: formData.get('description'),
    price: formData.get('price') ? Number(formData.get('price')) : undefined,
    is_available: formData.get('is_available') !== null
      ? formData.get('is_available') !== 'false'
      : undefined,
    earns_stamp: formData.get('earns_stamp') !== null
      ? formData.get('earns_stamp') === 'true'
      : undefined,
    ingredients: ingredientsRaw ? JSON.parse(ingredientsRaw as string) : undefined,
    energy_kcal: formData.get('energy_kcal') !== null
      ? (formData.get('energy_kcal') ? Number(formData.get('energy_kcal')) : null)
      : undefined,
    may_contain_allergens: mayContainRaw ? JSON.parse(mayContainRaw as string) : undefined,
    contains_alcohol: formData.get('contains_alcohol') !== null
      ? formData.get('contains_alcohol') === 'true'
      : undefined,
    contains_pork: formData.get('contains_pork') !== null
      ? formData.get('contains_pork') === 'true'
      : undefined,
    food_info_reviewed: formData.get('food_info_reviewed') !== null
      ? formData.get('food_info_reviewed') === 'true'
      : undefined,
    modifier_groups: modifierGroupsRaw ? JSON.parse(modifierGroupsRaw as string) : undefined,
    images: imagesRaw ? JSON.parse(imagesRaw as string) : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId!, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { id, restaurantId: _r, modifier_groups, images, ingredients, food_info_reviewed, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest }
  if (modifier_groups !== undefined) {
    updates['modifier_groups'] = modifier_groups as import('@garsonless/db').Json
  }
  if (images !== undefined) {
    updates['images'] = images as import('@garsonless/db').Json
  }
  if (ingredients !== undefined) {
    updates['ingredients'] = ingredients as import('@garsonless/db').Json
  }
  const foodInfoChanged = ingredients !== undefined ||
    parsed.data.energy_kcal !== undefined ||
    parsed.data.may_contain_allergens !== undefined ||
    parsed.data.contains_alcohol !== undefined ||
    parsed.data.contains_pork !== undefined ||
    modifier_groups !== undefined
  if (food_info_reviewed !== undefined || foodInfoChanged) {
    updates['food_info_reviewed_at'] = food_info_reviewed ? new Date().toISOString() : null
    updates['food_info_reviewed_by'] = food_info_reviewed ? user.id : null
  }

  const { error } = await mut(supabase, 'menu_items').update(updates).eq('id', id!)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { success: true }
}

export async function deleteItem(
  itemId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { error } = await mut(supabase, 'menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

/* reorderItems was a dead server action (0 callers). Item position is persisted
   per-item via updateItem; category ordering via reorderCategories. Removed in
   the dead-code cleanup. */
