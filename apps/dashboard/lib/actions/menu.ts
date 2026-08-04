'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertAccess } from '../auth/access'
import type { Tables } from '@garsonless/db/types'
import {
  ALLERGEN_CODES,
  getDietaryClaimsConflict,
  parseMenuNumericInput,
} from '@garsonless/domain/menu'
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  reorderMenuCategories,
  setMenuItemsAvailability as setMenuItemsAvailabilityCommand,
  updateMenuCategory,
  updateMenuItem,
  type MenuCategoryDraft,
  type MenuCategoryPatch,
  type MenuItemDraft,
  type MenuItemPatch,
} from '@garsonless/application/menu'
import {
  createMenuCommandPort,
  createRestaurantAssetStoragePort,
} from '@garsonless/db/server'
import { createDashboardServerClient } from '../supabase-server'
import {
  sniffMenuImageMime,
  validateMenuImageMetadata,
} from '../menu-image-policy'
import { sanitizeServerDiagnostic } from '../server-log-redaction'

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
  price: z.number().min(0.01),
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

async function getMenuActor(restaurantId: string) {
  const gate = await assertAccess(restaurantId, 'menu')
  if ('error' in gate) return gate
  return {
    actor: 'dashboard-member' as const,
    restaurantId,
    userId: gate.userId,
    permissions: ['menu'],
  }
}

export async function uploadMenuImage(
  formData: FormData,
): Promise<{ error: string } | { url: string }> {
  const input = z.object({
    restaurantId: z.string().uuid(),
    entityId: z.string().uuid(),
    kind: z.enum(['items', 'categories']),
  }).safeParse({
    restaurantId: formData.get('restaurantId'),
    entityId: formData.get('entityId'),
    kind: formData.get('kind'),
  })
  if (!input.success) return { error: 'Geçersiz görsel hedefi.' }

  const access = await assertAccess(input.data.restaurantId, 'menu')
  if ('error' in access) return access
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Görsel dosyası bulunamadı.' }

  const metadata = validateMenuImageMetadata({ size: file.size, type: file.type })
  if (!metadata.ok) return { error: metadata.error }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const detectedType = sniffMenuImageMime(bytes.subarray(0, 32))
  if (!detectedType || detectedType !== file.type) {
    return { error: 'Dosya içeriği ile görsel biçimi eşleşmiyor.' }
  }

  const extension: Record<typeof detectedType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  }
  const path = `restaurants/${input.data.restaurantId}/${input.data.kind}/${input.data.entityId}/${crypto.randomUUID()}.${extension[detectedType]}`
  try {
    const stored = await createRestaurantAssetStoragePort().uploadImmutable({
      path,
      bytes,
      contentType: detectedType,
    })
    return { url: stored.publicUrl }
  } catch (error) {
    console.error('[menu-image-upload-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Görsel yüklenemedi. Lütfen tekrar deneyin.' }
  }
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

export async function createCategory(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { id: string }> {
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

  const actor = await getMenuActor(parsed.data.restaurantId)
  if ('error' in actor) return actor
  const result = await createMenuCategory(
    actor,
    parsed.data as MenuCategoryDraft,
    createMenuCommandPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { id: result.value.id }
}

export async function updateCategory(
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
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

  const actor = await getMenuActor(parsed.data.restaurantId)
  if ('error' in actor) return actor
  const result = await updateMenuCategory(
    actor,
    parsed.data as MenuCategoryPatch,
    createMenuCommandPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { success: true }
}

export async function deleteCategory(
  categoryId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const categoryInput = z.string().uuid().safeParse(categoryId)
  const restaurantInput = z.string().uuid().safeParse(restaurantId)
  if (!categoryInput.success || !restaurantInput.success) return { error: 'Invalid input' }

  const actor = await getMenuActor(restaurantInput.data)
  if ('error' in actor) return actor
  const result = await deleteMenuCategory(actor, {
    categoryId: categoryInput.data,
    restaurantId: restaurantInput.data,
  }, createMenuCommandPort())
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function reorderCategories(
  restaurantId: string,
  orderedIds: string[],
): Promise<{ error: string } | { success: true }> {
  const restaurantInput = z.string().uuid().safeParse(restaurantId)
  const input = z.array(z.string().uuid()).max(500).safeParse(orderedIds)
  if (!restaurantInput.success || !input.success) return { error: 'Invalid category order' }
  const actor = await getMenuActor(restaurantInput.data)
  if ('error' in actor) return actor
  const result = await reorderMenuCategories(actor, {
    orderedIds: input.data,
    restaurantId: restaurantInput.data,
  }, createMenuCommandPort())
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function createItem(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { item: Tables<'menu_items'> }> {
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
    price: numericFormValue(formData, 'price', { required: true, min: 0.01 }),
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
    earns_stamp: formData.get('earns_stamp') === 'true',
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

  const actor = await getMenuActor(parsed.data.restaurantId)
  if ('error' in actor) return actor
  const result = await createMenuItem(
    actor,
    parsed.data as MenuItemDraft,
    createMenuCommandPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { item: result.value }
}

export async function updateItem(
  formData: FormData,
): Promise<{ error: string } | { item: Tables<'menu_items'> }> {
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
    price: numericFormValue(formData, 'price', { min: 0.01 }),
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

  const actor = await getMenuActor(parsed.data.restaurantId)
  if ('error' in actor) return actor
  const result = await updateMenuItem(
    actor,
    parsed.data as MenuItemPatch,
    createMenuCommandPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { item: result.value }
}

export async function replaceItemRecommendations(input: {
  restaurantId: string
  sourceItemId: string
  recommendedItemIds: string[]
}): Promise<{ success: true } | { error: string }> {
  const parsed = z.object({
    restaurantId: z.string().uuid(),
    sourceItemId: z.string().uuid(),
    recommendedItemIds: z.array(z.string().uuid()).max(10),
  }).superRefine((value, context) => {
    if (value.recommendedItemIds.includes(value.sourceItemId)) {
      context.addIssue({ code: 'custom', message: 'Bir ürün kendisine önerilemez.' })
    }
    if (new Set(value.recommendedItemIds).size !== value.recommendedItemIds.length) {
      context.addIssue({ code: 'custom', message: 'Aynı öneri birden fazla eklenemez.' })
    }
  }).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz öneri listesi.' }

  const access = await assertAccess(parsed.data.restaurantId, 'menu')
  if ('error' in access) return access
  const supabase = await createDashboardServerClient()
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: 'replace_menu_item_recommendations',
    args: { p_restaurant_id: string; p_source_item_id: string; p_recommended_item_ids: string[] },
  ) => Promise<{ error: { message: string } | null }>
  const { error } = await rpc('replace_menu_item_recommendations', {
    p_restaurant_id: parsed.data.restaurantId,
    p_source_item_id: parsed.data.sourceItemId,
    p_recommended_item_ids: parsed.data.recommendedItemIds,
  })
  if (error) {
    console.error('[menu-recommendation-update-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Ürün önerileri güncellenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
  revalidateTag(`menu:${parsed.data.restaurantId}`)
  return { success: true }
}

export async function deleteItem(
  itemId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const itemInput = z.string().uuid().safeParse(itemId)
  const restaurantInput = z.string().uuid().safeParse(restaurantId)
  if (!itemInput.success || !restaurantInput.success) return { error: 'Invalid input' }
  const actor = await getMenuActor(restaurantInput.data)
  if ('error' in actor) return actor
  const result = await deleteMenuItem(actor, {
    itemId: itemInput.data,
    restaurantId: restaurantInput.data,
  }, createMenuCommandPort())
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/menu`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function setMenuItemsAvailability(
  restaurantId: string,
  itemIds: string[],
  isAvailable: boolean,
): Promise<{ error: string } | { success: true }> {
  const restaurantInput = z.string().uuid().safeParse(restaurantId)
  const itemsInput = z.array(z.string().uuid()).min(1).max(500).safeParse(itemIds)
  if (!restaurantInput.success || !itemsInput.success || new Set(itemsInput.data).size !== itemsInput.data.length) {
    return { error: 'Invalid item selection' }
  }
  const actor = await getMenuActor(restaurantInput.data)
  if ('error' in actor) return actor
  const result = await setMenuItemsAvailabilityCommand(actor, {
    restaurantId: restaurantInput.data,
    itemIds: itemsInput.data,
    isAvailable,
  }, createMenuCommandPort())
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantInput.data}/menu`)
  revalidateTag(`menu:${restaurantInput.data}`)
  return { success: true }
}

/* reorderItems was a dead server action (0 callers). Item position is persisted
   per-item via updateItem; category ordering via reorderCategories. Removed in
   the dead-code cleanup. */
