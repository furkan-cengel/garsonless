'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { assertAccess } from '../auth/access'
import type { Tables } from '@garsonless/db'
import {
  ALLERGEN_CODES,
  getDietaryClaimsConflict,
  parseMenuNumericInput,
  separateAllergenDeclarations,
} from '@garsonless/db/order-client'

const categorySchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(300).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  parentId: z.string().uuid().optional(),
  vat_rate: z.number().min(0).max(100).optional(),
  kitchen_station_id: z.string().uuid().nullable().optional(),
})

const categoryUpdateSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  vat_rate: z.number().min(0).max(100).optional(),
  kitchen_station_id: z.string().uuid().nullable().optional(),
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
  amount: z.string().max(40).optional(),
})

const itemBaseSchema = z.object({
  categoryId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  price: z.number().min(0),
  vat_rate: z.number().min(0).max(100).nullable().optional(),
  kitchen_station_id: z.string().uuid().nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  is_available: z.boolean().default(true),
  earns_stamp: z.boolean().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  energy_kcal: z.number().int().min(0).nullable().optional(),
  protein_g: z.number().min(0).nullable().optional(),
  carb_g: z.number().min(0).nullable().optional(),
  fat_g: z.number().min(0).nullable().optional(),
  may_contain_allergens: z.array(z.enum(ALLERGEN_CODES)).optional(),
  contains_allergens: z.array(z.enum(ALLERGEN_CODES)).optional(),
  allergen_note: z.string().max(500).nullable().optional(),
  cross_contact_note: z.string().max(500).nullable().optional(),
  contains_alcohol: z.boolean().optional(),
  contains_pork: z.boolean().optional(),
  is_vegetarian: z.boolean().optional(),
  is_vegan: z.boolean().optional(),
  is_halal: z.boolean().optional(),
  food_info_reviewed: z.boolean().optional(),
  modifier_groups: z.array(modifierGroupSchema).optional(),
})

function dietaryConflictFor(input: {
  is_vegetarian?: boolean
  is_vegan?: boolean
  is_halal?: boolean
  contains_alcohol?: boolean
  contains_pork?: boolean
}) {
  return getDietaryClaimsConflict({
    vegetarian: input.is_vegetarian ?? false,
    vegan: input.is_vegan ?? false,
    halal: input.is_halal ?? false,
    containsAlcohol: input.contains_alcohol ?? false,
    containsPork: input.contains_pork ?? false,
  })
}

function numericFormValue(
  formData: FormData,
  key: string,
  options: Parameters<typeof parseMenuNumericInput>[1] = {},
): { ok: true; value: number | null | undefined } | { ok: false; error: string } {
  const raw = formData.get(key)
  if (raw === null) return { ok: true, value: undefined }
  const parsed = parseMenuNumericInput(raw, options)
  return parsed.ok ? parsed : { ok: false, error: parsed.error }
}

const itemSchema = itemBaseSchema.superRefine((item, context) => {
  const conflict = dietaryConflictFor(item)
  if (conflict) context.addIssue({ code: z.ZodIssueCode.custom, message: conflict })
})

const itemUpdateSchema = itemBaseSchema.partial().extend({
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

function nullableUuidFormValue(formData: FormData, key: string): string | null | undefined {
  const value = formData.get(key)
  if (value === null) return undefined
  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

function jsonFormValue(
  value: FormDataEntryValue | null,
  fallback: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (value === null || value === '') return { ok: true, value: fallback }
  if (typeof value !== 'string') return { ok: false, error: 'Invalid JSON input' }
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    return { ok: false, error: 'Invalid JSON input' }
  }
}

async function validateCategoryForRestaurant(
  supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  categoryId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  return !error && !!data
}

async function validateItemForRestaurant(
  supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  itemId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('category_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return false
  return validateCategoryForRestaurant(supabase, restaurantId, (data as { category_id: string }).category_id)
}

async function callMenuRpc(
  supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  name: 'delete_menu_category' | 'reorder_menu_categories' | 'set_menu_items_availability',
  args: Record<string, string | string[] | boolean>,
) {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    functionName: string,
    parameters: Record<string, string | string[] | boolean>,
  ) => Promise<{ error: { message: string } | null }>
  return rpc(name, args)
}

async function validateKitchenStationForRestaurant(
  supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  stationId: string | null | undefined,
): Promise<boolean> {
  if (stationId == null) return true
  const { data } = await supabase
    .from('kitchen_stations')
    .select('id')
    .eq('id', stationId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  return !!data
}

export async function createCategory(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const categoryVat = numericFormValue(formData, 'vat_rate', { min: 0, max: 100 })
  if (!categoryVat.ok) return { error: categoryVat.error }

  const parsed = categorySchema.safeParse({
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name'),
    description: formData.get('description') ?? null,
    image_url: formData.get('image_url') || null,
    parentId: formData.get('parentId') ?? undefined,
    vat_rate: categoryVat.value ?? undefined,
    kitchen_station_id: nullableUuidFormValue(formData, 'kitchen_station_id'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }
  if (parsed.data.parentId && !(await validateCategoryForRestaurant(supabase, parsed.data.restaurantId, parsed.data.parentId))) {
    return { error: 'Invalid parent category' }
  }
  if (!(await validateKitchenStationForRestaurant(supabase, parsed.data.restaurantId, parsed.data.kitchen_station_id))) {
    return { error: 'Invalid kitchen station' }
  }

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
      image_url: parsed.data.image_url ?? null,
      vat_rate: parsed.data.vat_rate ?? 10,
      kitchen_station_id: parsed.data.kitchen_station_id ?? null,
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
  const categoryVat = numericFormValue(formData, 'vat_rate', { min: 0, max: 100 })
  if (!categoryVat.ok) return { error: categoryVat.error }

  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get('id'),
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name') ?? undefined,
    description: formData.get('description'),
    image_url: formData.get('image_url') || null,
    vat_rate: categoryVat.value ?? undefined,
    kitchen_station_id: nullableUuidFormValue(formData, 'kitchen_station_id'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }
  if (!(await validateCategoryForRestaurant(supabase, parsed.data.restaurantId, parsed.data.id))) {
    return { error: 'Category not found' }
  }
  if (!(await validateKitchenStationForRestaurant(supabase, parsed.data.restaurantId, parsed.data.kitchen_station_id))) {
    return { error: 'Invalid kitchen station' }
  }

  const { id, restaurantId: _r, ...updates } = parsed.data
  const { error } = await mut(supabase, 'menu_categories')
    .update(updates as Record<string, unknown>)
    .eq('id', id)
    .eq('restaurant_id', parsed.data.restaurantId)

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

  const categoryInput = z.string().uuid().safeParse(categoryId)
  const restaurantInput = z.string().uuid().safeParse(restaurantId)
  if (!categoryInput.success || !restaurantInput.success) return { error: 'Invalid input' }

  const { error } = await callMenuRpc(supabase, 'delete_menu_category', {
    p_category_id: categoryInput.data,
    p_restaurant_id: restaurantInput.data,
  })

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
  const input = z.array(z.string().uuid()).max(500).safeParse(orderedIds)
  if (!input.success || new Set(input.data).size !== input.data.length) return { error: 'Invalid category order' }

  const { error } = await callMenuRpc(supabase, 'reorder_menu_categories', {
    p_ordered_ids: input.data,
    p_restaurant_id: restaurantId,
  })
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function createItem(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { item: Tables<'menu_items'> }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const modifierGroupsRaw = formData.get('modifier_groups')
  const ingredientsRaw = formData.get('ingredients')
  const mayContainRaw = formData.get('may_contain_allergens')
  const containsRaw = formData.get('contains_allergens')
  const jsonFields = {
    modifierGroups: jsonFormValue(modifierGroupsRaw, []),
    ingredients: jsonFormValue(ingredientsRaw, []),
    mayContain: jsonFormValue(mayContainRaw, []),
    contains: jsonFormValue(containsRaw, []),
  }
  const invalidJson = Object.values(jsonFields).find((field) => !field.ok)
  if (invalidJson && !invalidJson.ok) return { error: invalidJson.error }
  const numericFields = {
    price: numericFormValue(formData, 'price', { required: true, min: 0 }),
    vatRate: numericFormValue(formData, 'vat_rate', { min: 0, max: 100 }),
    cost: numericFormValue(formData, 'cost', { min: 0 }),
    energyKcal: numericFormValue(formData, 'energy_kcal', { integer: true, min: 0 }),
    protein: numericFormValue(formData, 'protein_g', { min: 0 }),
    carb: numericFormValue(formData, 'carb_g', { min: 0 }),
    fat: numericFormValue(formData, 'fat_g', { min: 0 }),
  }
  const invalidNumeric = Object.values(numericFields).find((field) => !field.ok)
  if (invalidNumeric && !invalidNumeric.ok) return { error: invalidNumeric.error }
  const parsed = itemSchema.safeParse({
    categoryId: formData.get('categoryId'),
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name'),
    description: formData.get('description') ?? null,
    price: numericFields.price.ok ? numericFields.price.value : undefined,
    vat_rate: numericFields.vatRate.ok ? numericFields.vatRate.value : undefined,
    kitchen_station_id: nullableUuidFormValue(formData, 'kitchen_station_id'),
    cost: numericFields.cost.ok ? numericFields.cost.value : undefined,
    is_available: formData.get('is_available') !== 'false',
    ingredients: jsonFields.ingredients.ok ? jsonFields.ingredients.value : [],
    energy_kcal: numericFields.energyKcal.ok ? numericFields.energyKcal.value : undefined,
    protein_g: numericFields.protein.ok ? numericFields.protein.value : undefined,
    carb_g: numericFields.carb.ok ? numericFields.carb.value : undefined,
    fat_g: numericFields.fat.ok ? numericFields.fat.value : undefined,
    may_contain_allergens: jsonFields.mayContain.ok ? jsonFields.mayContain.value : [],
    contains_allergens: jsonFields.contains.ok ? jsonFields.contains.value : [],
    allergen_note: String(formData.get('allergen_note') ?? '').trim() || null,
    cross_contact_note: String(formData.get('cross_contact_note') ?? '').trim() || null,
    contains_alcohol: formData.get('contains_alcohol') === 'true',
    contains_pork: formData.get('contains_pork') === 'true',
    is_vegetarian: formData.get('is_vegetarian') === 'true',
    is_vegan: formData.get('is_vegan') === 'true',
    is_halal: formData.get('is_halal') === 'true',
    food_info_reviewed: formData.get('food_info_reviewed') === 'true',
    modifier_groups: jsonFields.modifierGroups.ok ? jsonFields.modifierGroups.value : [],
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }
  if (!(await validateCategoryForRestaurant(supabase, parsed.data.restaurantId, parsed.data.categoryId))) {
    return { error: 'Invalid category' }
  }
  if (!(await validateKitchenStationForRestaurant(supabase, parsed.data.restaurantId, parsed.data.kitchen_station_id))) {
    return { error: 'Invalid kitchen station' }
  }
  const allergenDeclarations = separateAllergenDeclarations(
    parsed.data.contains_allergens,
    parsed.data.may_contain_allergens,
  )

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
      vat_rate: parsed.data.vat_rate ?? null,
      kitchen_station_id: parsed.data.kitchen_station_id ?? null,
      cost: parsed.data.cost ?? null,
      is_available: parsed.data.is_available,
      ingredients: (parsed.data.ingredients ?? []) as import('@garsonless/db').Json,
      energy_kcal: parsed.data.energy_kcal ?? null,
      protein_g: parsed.data.protein_g ?? null,
      carb_g: parsed.data.carb_g ?? null,
      fat_g: parsed.data.fat_g ?? null,
      may_contain_allergens: allergenDeclarations.traces,
      contains_allergens: allergenDeclarations.contains,
      allergen_note: parsed.data.allergen_note ?? null,
      cross_contact_note: parsed.data.cross_contact_note ?? null,
      contains_alcohol: parsed.data.contains_alcohol ?? false,
      contains_pork: parsed.data.contains_pork ?? false,
      is_vegetarian: parsed.data.is_vegetarian ?? false,
      is_vegan: parsed.data.is_vegan ?? false,
      is_halal: parsed.data.is_halal ?? false,
      food_info_reviewed_at: parsed.data.food_info_reviewed ? new Date().toISOString() : null,
      food_info_reviewed_by: parsed.data.food_info_reviewed ? user.id : null,
      modifier_groups: (parsed.data.modifier_groups ?? []) as import('@garsonless/db').Json,
      images: [] as import('@garsonless/db').Json,
      position,
    })
    .select('*')
    .single()

  if (error) return { error: error.message }

  const item = data as Tables<'menu_items'> | null
  if (!item) return { error: 'Failed to create item' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { item }
}

export async function updateItem(
  formData: FormData,
): Promise<{ error: string } | { item: Tables<'menu_items'> }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const modifierGroupsRaw = formData.get('modifier_groups')
  const imagesRaw = formData.get('images')
  const ingredientsRaw = formData.get('ingredients')
  const mayContainRaw = formData.get('may_contain_allergens')
  const containsRaw = formData.get('contains_allergens')
  const jsonFields = {
    modifierGroups: jsonFormValue(modifierGroupsRaw, undefined),
    images: jsonFormValue(imagesRaw, undefined),
    ingredients: jsonFormValue(ingredientsRaw, undefined),
    mayContain: jsonFormValue(mayContainRaw, undefined),
    contains: jsonFormValue(containsRaw, undefined),
  }
  const invalidJson = Object.values(jsonFields).find((field) => !field.ok)
  if (invalidJson && !invalidJson.ok) return { error: invalidJson.error }
  const boolOrUndef = (k: string) => formData.get(k) !== null ? formData.get(k) === 'true' : undefined
  const numericFields = {
    price: numericFormValue(formData, 'price', { min: 0 }),
    vatRate: numericFormValue(formData, 'vat_rate', { min: 0, max: 100 }),
    cost: numericFormValue(formData, 'cost', { min: 0 }),
    energyKcal: numericFormValue(formData, 'energy_kcal', { integer: true, min: 0 }),
    protein: numericFormValue(formData, 'protein_g', { min: 0 }),
    carb: numericFormValue(formData, 'carb_g', { min: 0 }),
    fat: numericFormValue(formData, 'fat_g', { min: 0 }),
  }
  const invalidNumeric = Object.values(numericFields).find((field) => !field.ok)
  if (invalidNumeric && !invalidNumeric.ok) return { error: invalidNumeric.error }
  const parsed = itemUpdateSchema.safeParse({
    id: formData.get('id'),
    restaurantId: formData.get('restaurantId'),
    categoryId: formData.get('categoryId') ?? undefined,
    name: formData.get('name') ?? undefined,
    description: formData.get('description'),
    price: numericFields.price.ok ? numericFields.price.value : undefined,
    vat_rate: numericFields.vatRate.ok ? numericFields.vatRate.value : undefined,
    kitchen_station_id: nullableUuidFormValue(formData, 'kitchen_station_id'),
    is_available: formData.get('is_available') !== null
      ? formData.get('is_available') !== 'false'
      : undefined,
    earns_stamp: formData.get('earns_stamp') !== null
      ? formData.get('earns_stamp') === 'true'
      : undefined,
    ingredients: jsonFields.ingredients.ok ? jsonFields.ingredients.value : undefined,
    energy_kcal: numericFields.energyKcal.ok ? numericFields.energyKcal.value : undefined,
    may_contain_allergens: jsonFields.mayContain.ok ? jsonFields.mayContain.value : undefined,
    contains_allergens: jsonFields.contains.ok ? jsonFields.contains.value : undefined,
    allergen_note: formData.get('allergen_note') !== null ? String(formData.get('allergen_note')).trim() || null : undefined,
    cross_contact_note: formData.get('cross_contact_note') !== null ? String(formData.get('cross_contact_note')).trim() || null : undefined,
    cost: numericFields.cost.ok ? numericFields.cost.value : undefined,
    protein_g: numericFields.protein.ok ? numericFields.protein.value : undefined,
    carb_g: numericFields.carb.ok ? numericFields.carb.value : undefined,
    fat_g: numericFields.fat.ok ? numericFields.fat.value : undefined,
    is_vegetarian: boolOrUndef('is_vegetarian'),
    is_vegan: boolOrUndef('is_vegan'),
    is_halal: boolOrUndef('is_halal'),
    contains_alcohol: formData.get('contains_alcohol') !== null
      ? formData.get('contains_alcohol') === 'true'
      : undefined,
    contains_pork: formData.get('contains_pork') !== null
      ? formData.get('contains_pork') === 'true'
      : undefined,
    food_info_reviewed: formData.get('food_info_reviewed') !== null
      ? formData.get('food_info_reviewed') === 'true'
      : undefined,
    modifier_groups: jsonFields.modifierGroups.ok ? jsonFields.modifierGroups.value : undefined,
    images: jsonFields.images.ok ? jsonFields.images.value : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId!, user.id)
  if (!isOwner) return { error: 'Not authorized' }
  if (!(await validateItemForRestaurant(supabase, parsed.data.restaurantId!, parsed.data.id))) {
    return { error: 'Item not found' }
  }
  if (parsed.data.categoryId && !(await validateCategoryForRestaurant(supabase, parsed.data.restaurantId!, parsed.data.categoryId))) {
    return { error: 'Invalid category' }
  }
  if (!(await validateKitchenStationForRestaurant(supabase, parsed.data.restaurantId!, parsed.data.kitchen_station_id))) {
    return { error: 'Invalid kitchen station' }
  }

  const { data: existing, error: existingError } = await supabase
    .from('menu_items')
    .select('id, is_vegetarian, is_vegan, is_halal, contains_alcohol, contains_pork, contains_allergens, may_contain_allergens')
    .eq('id', parsed.data.id)
    .single()
  const existingItem = existing as Pick<
    Tables<'menu_items'>,
    'id' | 'is_vegetarian' | 'is_vegan' | 'is_halal' | 'contains_alcohol' | 'contains_pork' | 'contains_allergens' | 'may_contain_allergens'
  > | null
  if (existingError || !existingItem) return { error: 'Item not found' }

  const dietaryConflict = getDietaryClaimsConflict({
    vegetarian: parsed.data.is_vegetarian ?? existingItem.is_vegetarian,
    vegan: parsed.data.is_vegan ?? existingItem.is_vegan,
    halal: parsed.data.is_halal ?? existingItem.is_halal,
    containsAlcohol: parsed.data.contains_alcohol ?? existingItem.contains_alcohol,
    containsPork: parsed.data.contains_pork ?? existingItem.contains_pork,
  })
  if (dietaryConflict) return { error: dietaryConflict }

  const { id, restaurantId: _r, modifier_groups, images, ingredients, food_info_reviewed, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest }
  if (modifier_groups !== undefined) {
    updates['modifier_groups'] = modifier_groups as import('@garsonless/db').Json
  }
  if (images !== undefined) {
    updates['images'] = images as import('@garsonless/db').Json
  }
  if (parsed.data.contains_allergens !== undefined || parsed.data.may_contain_allergens !== undefined) {
    const allergenDeclarations = separateAllergenDeclarations(
      parsed.data.contains_allergens ?? existingItem.contains_allergens,
      parsed.data.may_contain_allergens ?? existingItem.may_contain_allergens,
    )
    updates['contains_allergens'] = allergenDeclarations.contains
    updates['may_contain_allergens'] = allergenDeclarations.traces
  }
  if (ingredients !== undefined) {
    updates['ingredients'] = ingredients as import('@garsonless/db').Json
  }
  const foodInfoChanged = ingredients !== undefined ||
    parsed.data.energy_kcal !== undefined ||
    parsed.data.protein_g !== undefined ||
    parsed.data.carb_g !== undefined ||
    parsed.data.fat_g !== undefined ||
    parsed.data.contains_allergens !== undefined ||
    parsed.data.allergen_note !== undefined ||
    parsed.data.cross_contact_note !== undefined ||
    parsed.data.may_contain_allergens !== undefined ||
    parsed.data.contains_alcohol !== undefined ||
    parsed.data.contains_pork !== undefined ||
    parsed.data.is_vegetarian !== undefined ||
    parsed.data.is_vegan !== undefined ||
    parsed.data.is_halal !== undefined ||
    modifier_groups !== undefined
  if (food_info_reviewed !== undefined || foodInfoChanged) {
    updates['food_info_reviewed_at'] = food_info_reviewed ? new Date().toISOString() : null
    updates['food_info_reviewed_by'] = food_info_reviewed ? user.id : null
  }

  const { data, error } = await mut(supabase, 'menu_items').update(updates).eq('id', id!).select('*')

  if (error) return { error: error.message }
  const item = data?.[0] as Tables<'menu_items'> | undefined
  if (!item) return { error: 'Item not found' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { item }
}

export async function deleteItem(
  itemId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }
  if (!(await validateItemForRestaurant(supabase, restaurantId, itemId))) return { error: 'Item not found' }

  const { error } = await mut(supabase, 'menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function setMenuItemsAvailability(
  restaurantId: string,
  itemIds: string[],
  isAvailable: boolean,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const restaurantInput = z.string().uuid().safeParse(restaurantId)
  const itemsInput = z.array(z.string().uuid()).min(1).max(500).safeParse(itemIds)
  if (!restaurantInput.success || !itemsInput.success || new Set(itemsInput.data).size !== itemsInput.data.length) {
    return { error: 'Invalid item selection' }
  }
  if (!(await assertRestaurantOwner(supabase, restaurantInput.data, user.id))) return { error: 'Not authorized' }

  const { error } = await callMenuRpc(supabase, 'set_menu_items_availability', {
    p_restaurant_id: restaurantInput.data,
    p_item_ids: itemsInput.data,
    p_is_available: isAvailable,
  })
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantInput.data}/menu`)
  revalidateTag(`menu:${restaurantInput.data}`)
  return { success: true }
}

/* reorderItems was a dead server action (0 callers). Item position is persisted
   per-item via updateItem; category ordering via reorderCategories. Removed in
   the dead-code cleanup. */
