'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { slugify } from '../utils'
import type { Tables } from '@garsonless/db/types'
import { patchRestaurantSettings } from '@garsonless/application/restaurants'
import {
  createKitchenSettingsCommandPort,
  createRestaurantSettingsPort,
} from '@garsonless/db/server'
import {
  reorderKitchenStations as reorderKitchenStationsCommand,
  rotateKitchenAccessCredential,
} from '@garsonless/application/kitchen'
import { canUseFeature } from '@garsonless/domain'
import { sanitizeTiers } from '@garsonless/domain/loyalty'
import { assertOwner, getUserRestaurantAccess } from '../auth/access'
import type { DashboardActionFailure } from '../server-action-error'
import { dashboardActionFailure } from '../server-action-error'

const createRestaurantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
})

const updateRestaurantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  logo_url: z.string().url().nullable().optional(),
})

const kitchenStationSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2e7d52'),
  is_active: z.boolean().optional(),
})

const kitchenStationUpdateSchema = kitchenStationSchema.partial().extend({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
})

function getActionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function assertRestaurantOwner(restaurantId: string) {
  const { supabase, user } = await getAuthUser()
  if (!user) return { supabase, user, ok: false as const, error: 'Not authenticated' }
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()
  if (!restaurant) return { supabase, user, ok: false as const, error: 'Not authorized' }
  return { supabase, user, ok: true as const }
}

export async function createRestaurant(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { id: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const rawName = formData.get('name') as string | null
  const rawSlug = formData.get('slug') as string | null
  const parsed = createRestaurantSchema.safeParse({
    name: rawName,
    slug: rawSlug ?? slugify(rawName ?? ''),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { data, error } = await mut(supabase, 'restaurants')
    .insert({ name: parsed.data.name, slug: parsed.data.slug, owner_id: user.id })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'That slug is already taken' }
    return { error: error.message }
  }

  const id = (data as { id: string } | null)?.id
  if (!id) return { error: 'Failed to create restaurant' }

  revalidatePath('/dashboard')
  return { id }
}

export async function updateRestaurant(
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = updateRestaurantSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name') ?? undefined,
    slug: formData.get('slug') ?? undefined,
    logo_url: formData.get('logo_url') ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { id, ...updates } = parsed.data
  const { error } = await mut(supabase, 'restaurants')
    .update(updates as Record<string, unknown>)
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'That slug is already taken' }
    return { error: error.message }
  }

  revalidatePath(`/dashboard/${id}`)
  revalidatePath(`/dashboard/${id}/settings`)
  return { success: true }
}

export async function updateSettings(
  restaurantId: string,
  settings: Record<string, unknown>,
): Promise<{ error: string } | { success: true }> {
  const { user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access || (!access.isOwner && !access.permissions.includes('settings'))) {
    return { error: 'Not authorized' }
  }
  const result = await patchRestaurantSettings(
    {
      actor: 'dashboard-member',
      userId: user.id,
      restaurantId,
      permissions: access.permissions,
      isOwner: access.isOwner,
    },
    { restaurantId, patch: settings },
    createRestaurantSettingsPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

// Notification channel prefs → restaurants.settings.notifications (JSONB).
// Zod-validated shape; only the four real channels are accepted.
const notificationPrefsSchema = z.object({
  newOrderSound: z.boolean(),
  newOrderPush: z.boolean(),
  newOrderToast: z.boolean(),
  serviceRequestAlert: z.boolean(),
  serviceRequestPush: z.boolean(),
})

const notificationSettingsSchema = z.object({
  prefs: notificationPrefsSchema,
  lateThresholdMin: z.number().int().min(5).max(120),
})

const businessTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Geçersiz saat')
const businessDaySchema = z.object({
  open: businessTimeSchema,
  close: businessTimeSchema,
  active: z.boolean(),
})
const businessHoursSchema = z.object({
  mon: businessDaySchema,
  tue: businessDaySchema,
  wed: businessDaySchema,
  thu: businessDaySchema,
  fri: businessDaySchema,
  sat: businessDaySchema,
  sun: businessDaySchema,
}).superRefine((hours, ctx) => {
  for (const [day, value] of Object.entries(hours)) {
    if (value.active && value.open >= value.close) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [day, 'close'],
        message: 'Kapanış saati açılıştan sonra olmalı',
      })
    }
  }
})

/**
 * The current hours model represents one same-day interval per weekday. Reject
 * malformed and overnight intervals rather than publishing an ambiguous menu
 * state; split/overnight schedules need their own data-model epic.
 */
export async function saveBusinessHours(
  restaurantId: string,
  hours: unknown,
): Promise<{ error: string } | { success: true }> {
  const parsed = businessHoursSchema.safeParse(hours)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz çalışma saatleri' }
  }
  return updateSettings(restaurantId, { hours: parsed.data })
}

/**
 * Persist every control in the Notifications section in one JSONB patch.
 *
 * The settings RPC merges the top-level keys atomically. Keeping preferences
 * and the order-late threshold in the same command prevents a partial save
 * where the first request succeeds and the second one fails.
 */
export async function saveNotificationPreferences(
  restaurantId: string,
  input: unknown,
): Promise<{ error: string } | DashboardActionFailure | { success: true }> {
  const parsed = notificationSettingsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Geçersiz bildirim ayarları' }

  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access || (!access.isOwner && !access.permissions.includes('settings'))) {
    return { error: 'Not authorized' }
  }
  const { data: restaurant, error: planError } = await supabase
    .from('restaurants')
    .select('plan')
    .eq('id', restaurantId)
    .maybeSingle()
  if (planError) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.settings.save',
      cause: planError,
    })
  }
  if (!restaurant) return { error: 'Not authorized' }
  const restaurantPlan = (restaurant as unknown as { plan?: unknown }).plan
  if (
    (parsed.data.prefs.newOrderPush || parsed.data.prefs.serviceRequestPush)
    && !canUseFeature(restaurantPlan, 'browser_notifications')
  ) {
    return dashboardActionFailure('PLAN_REQUIRED', {
      operation: 'notifications.settings.save',
      message: 'Masaüstü bildirimleri Starter ve üstü paketlerde kullanılabilir.',
    })
  }
  const result = await patchRestaurantSettings(
    {
      actor: 'dashboard-member',
      userId: user.id,
      restaurantId,
      permissions: access.permissions,
      isOwner: access.isOwner,
    },
    {
      restaurantId,
      patch: {
        notifications: parsed.data.prefs,
        orders: { late_threshold_min: parsed.data.lateThresholdMin },
      },
    },
    createRestaurantSettingsPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  // Orders board + shell read prefs from the restaurant row on next load.
  revalidatePath(`/dashboard/${restaurantId}`, 'layout')
  return { success: true }
}

/** Menu items for the loyalty reward-item picker (owner-validated). */
export async function getRewardItemChoices(
  restaurantId: string,
): Promise<{ error: string } | { items: Array<{ id: string; name: string }> }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: owned } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!owned) return { error: 'Not authorized' }

  const { data } = await supabase
    .from('menu_items')
    .select('id, name, menu_categories!inner(restaurant_id)')
    .eq('menu_categories.restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('name')
  const items = ((data as Array<{ id: string; name: string }> | null) ?? []).map((r) => ({ id: r.id, name: r.name }))
  return { items }
}

/** Save the loyalty config. Validates that reward_item_id + every reward_catalog
 *  itemId actually belong to this restaurant — invalid ids are dropped, never
 *  saved (the engine re-reads pointCost server-side, so the catalog is trusted). */
export async function saveLoyaltyConfig(
  restaurantId: string,
  loyalty: Record<string, unknown>,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const access = await getUserRestaurantAccess(restaurantId)
  if (!access?.isOwner) return { error: 'Not authorized' }

  // Settings JSON may preserve a loyalty configuration after a downgrade, but
  // it must not be editable/executable until the plan is upgraded again.
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('plan')
    .eq('id', restaurantId)
    .maybeSingle()
  if (!restaurant || !canUseFeature((restaurant as { plan?: unknown }).plan, 'loyalty')) {
    return { error: 'Sadakat programı Pro paketiyle kullanılabilir.' }
  }

  const cfg = { ...loyalty }

  // All menu-item ids this restaurant owns (used to validate reward selections).
  const { data: ownedItems } = await supabase
    .from('menu_items')
    .select('id, menu_categories!inner(restaurant_id)')
    .eq('menu_categories.restaurant_id', restaurantId)
    .is('deleted_at', null)
  const ownedIds = new Set(((ownedItems as Array<{ id: string }> | null) ?? []).map((r) => r.id))

  // Tier ladder (Sprint 17): sanitize with the SAME rules as read-time — N≤6,
  // ascending min, tiers[0].min=0, unique names, perk defaults + clamps. Defense
  // in depth on top of the client-side guard.
  if (Array.isArray(cfg['tiers'])) {
    const tiers = sanitizeTiers(cfg['tiers'] as unknown[])
    cfg['tiers'] = tiers
    // 17b legacy fold: once ANY tier carries its own discountPct, the flat
    // member_discount_pct fallback becomes inert (set 0) so it can't double-apply
    // or override a deliberate 0% tier. Legacy all-zero ladders keep the fallback.
    if (tiers.some((t) => t.discountPct > 0)) {
      cfg['member_discount_pct'] = 0
    }
  }

  const rewardId = typeof cfg['reward_item_id'] === 'string' ? (cfg['reward_item_id'] as string) : null
  cfg['reward_item_id'] = rewardId && ownedIds.has(rewardId) ? rewardId : null // clamp invalid id to null

  // reward_catalog (15c): keep only entries whose item is owned + pointCost > 0.
  const rawCatalog = Array.isArray(cfg['reward_catalog']) ? (cfg['reward_catalog'] as unknown[]) : []
  const seen = new Set<string>()
  cfg['reward_catalog'] = rawCatalog.flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const itemId = typeof o['itemId'] === 'string' ? o['itemId'] : null
    const pointCost = typeof o['pointCost'] === 'number' ? Math.floor(o['pointCost']) : null
    if (!itemId || !ownedIds.has(itemId) || pointCost === null || pointCost <= 0 || seen.has(itemId)) return []
    seen.add(itemId)
    const tag = typeof o['tag'] === 'string' && o['tag'] ? { tag: (o['tag'] as string).slice(0, 24) } : {}
    return [{ itemId, pointCost, ...tag }]
  })

  // Do not read/merge/write the complete settings JSON here. That former path
  // could overwrite a concurrent Theme, QR or Settings update. The shared
  // application command delegates to the atomic JSONB patch RPC instead.
  const result = await patchRestaurantSettings(
    {
      actor: 'dashboard-member',
      userId: user.id,
      restaurantId,
      permissions: access.permissions,
      isOwner: true,
    },
    { restaurantId, patch: { loyalty: cfg } },
    createRestaurantSettingsPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function checkSlugAvailable(slug: string): Promise<boolean> {
  const supabase = await createDashboardServerClient()
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()
  return data === null
}

export async function removeLogo(
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await mut(supabase, 'restaurants')
    .update({ logo_url: null })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
  if (error) return { error: error.message }
  revalidatePath(`/dashboard/${restaurantId}`)
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function uploadLogo(
  restaurantId: string,
  formData: FormData,
): Promise<{ error: string } | { url: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }
  if (file.size > 2 * 1024 * 1024) return { error: 'File must be under 2MB' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image' }

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${user.id}/${restaurantId}/logo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('restaurant-assets')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)

  const { data: updatedRows, error: updateError } = await mut(supabase, 'restaurants')
    .update({ logo_url: data.publicUrl })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .select('id')

  // Storage upload and restaurant metadata must either both succeed or report a
  // failure. Roll back the new object when the owner-scoped row update did not
  // land so the UI never claims that a logo was saved when it was not.
  if (updateError || !updatedRows?.length) {
    await supabase.storage.from('restaurant-assets').remove([path])
    return { error: updateError?.message ?? 'Logo güncellenemedi' }
  }

  revalidatePath(`/dashboard/${restaurantId}`)
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return { url: data.publicUrl }
}

export async function createKitchenStation(
  formData: FormData,
): Promise<{ error: string } | { station: Tables<'kitchen_stations'> }> {
  const parsed = kitchenStationSchema.safeParse({
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name'),
    color: formData.get('color') || '#2e7d52',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    const gate = await assertRestaurantOwner(parsed.data.restaurantId)
    if (!gate.ok) return { error: gate.error }

    const { data: maxPos } = await gate.supabase
      .from('kitchen_stations')
      .select('position')
      .eq('restaurant_id', parsed.data.restaurantId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const position = ((maxPos as { position: number } | null)?.position ?? -1) + 1

    const { data, error } = await mut(gate.supabase, 'kitchen_stations')
      .insert({
        restaurant_id: parsed.data.restaurantId,
        name: parsed.data.name,
        color: parsed.data.color,
        position,
        is_active: true,
      })
      .select('*')
      .single()
    if (error) return { error: error.message }
    const station = data as Tables<'kitchen_stations'> | null
    if (!station) return { error: 'Failed to create station' }

    revalidatePath(`/dashboard/${parsed.data.restaurantId}/settings`)
    revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
    return { station }
  } catch (error) {
    return { error: getActionErrorMessage(error, 'Mutfak istasyonu oluşturulamadı') }
  }
}

export async function updateKitchenStation(
  formData: FormData,
): Promise<{ error: string } | { station: Tables<'kitchen_stations'> }> {
  const parsed = kitchenStationUpdateSchema.safeParse({
    id: formData.get('id'),
    restaurantId: formData.get('restaurantId'),
    name: formData.get('name') ?? undefined,
    color: formData.get('color') || undefined,
    is_active: formData.get('is_active') !== null ? formData.get('is_active') === 'true' : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    const gate = await assertRestaurantOwner(parsed.data.restaurantId)
    if (!gate.ok) return { error: gate.error }

    const { id, restaurantId, ...updates } = parsed.data
    const { data, error } = await mut(gate.supabase, 'kitchen_stations')
      .update(updates)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select('*')
    if (error) return { error: error.message }
    const station = (data?.[0] ?? null) as Tables<'kitchen_stations'> | null
    if (!station) return { error: 'Station not found' }

    revalidatePath(`/dashboard/${restaurantId}/settings`)
    revalidatePath(`/dashboard/${restaurantId}/menu`)
    return { station }
  } catch (error) {
    return { error: getActionErrorMessage(error, 'Mutfak istasyonu güncellenemedi') }
  }
}

export async function reorderKitchenStations(
  restaurantId: string,
  orderedIds: string[],
): Promise<{ error: string } | { success: true }> {
  const parsedRestaurantId = z.string().uuid().safeParse(restaurantId)
  const parsedIds = z.array(z.string().uuid()).safeParse(orderedIds)
  if (!parsedRestaurantId.success || !parsedIds.success) return { error: 'Invalid input' }

  try {
    const gate = await assertOwner(parsedRestaurantId.data)
    if ('error' in gate) return gate
    const result = await reorderKitchenStationsCommand({
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId: parsedRestaurantId.data,
      permissions: ['settings'],
      isOwner: true,
    }, {
      restaurantId: parsedRestaurantId.data,
      orderedIds: parsedIds.data,
    }, createKitchenSettingsCommandPort())
    if (!result.ok) return { error: result.error }

    revalidatePath(`/dashboard/${parsedRestaurantId.data}/settings`)
    return { success: true }
  } catch (error) {
    return { error: getActionErrorMessage(error, 'Mutfak istasyonları sıralanamadı') }
  }
}

export async function generateKitchenToken(
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const parsedRestaurantId = z.string().uuid().safeParse(restaurantId)
  if (!parsedRestaurantId.success) return { error: 'Invalid input' }
  const gate = await assertOwner(parsedRestaurantId.data)
  if ('error' in gate) return gate
  const result = await rotateKitchenAccessCredential({
    actor: 'dashboard-member',
    userId: gate.userId,
    restaurantId: parsedRestaurantId.data,
    permissions: ['settings'],
    isOwner: true,
  }, { restaurantId: parsedRestaurantId.data }, createKitchenSettingsCommandPort())
  if (!result.ok) {
    return {
      error: result.error === 'Plan feature unavailable'
        ? 'Mutfak ekranı Pro paketiyle kullanılabilir.'
        : result.error,
    }
  }

  revalidatePath(`/dashboard/${parsedRestaurantId.data}/settings`)
  revalidatePath(`/dashboard/${parsedRestaurantId.data}/orders`)
  return { success: true }
}
