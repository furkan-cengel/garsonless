'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { slugify } from '../utils'
import type { Tables } from '@garsonless/db/types'
import { patchRestaurantSettings } from '@garsonless/application/restaurants'
import type { RestaurantSettingsPatchResult } from '@garsonless/application/restaurants'
import {
  canRestaurantUseFeature,
  createKitchenSettingsCommandPort,
  createRestaurantAssetStoragePort,
  createRestaurantSettingsPort,
  hasKitchenCredential,
  updateRestaurantTimezoneCas,
} from '@garsonless/db/server'
import {
  reorderKitchenStations as reorderKitchenStationsCommand,
  rotateKitchenAccessCredential,
} from '@garsonless/application/kitchen'
import { sanitizeTiers } from '@garsonless/domain/loyalty'
import { assertOwner, assertRestaurantFeature, getUserRestaurantAccess } from '../auth/access'
import type { DashboardActionFailure } from '../server-action-error'
import { dashboardActionFailure } from '../server-action-error'
import { inspectLogoImage, validateLogoImageMetadata } from '../logo-image-policy'
import { sanitizeServerDiagnostic } from '../server-log-redaction'
import { requireFreshOwnerPassword } from '../auth/fresh-owner-auth'

const createRestaurantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  planIntent: z.enum(['starter', 'plus', 'pro']).nullable(),
})

const updateRestaurantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  logo_url: z.string().url().nullable().optional(),
})

const timezoneUpdateSchema = z.object({
  timezone: z.string().trim().min(1).max(100).refine((value) => {
    try { new Intl.DateTimeFormat('tr-TR', { timeZone: value }); return true } catch { return false }
  }, 'Geçersiz IANA zaman dilimi'),
  expectedTimezone: z.string().trim().min(1).max(100),
  requestId: z.string().uuid(),
}).strict()

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

const settingsWriteGuardSchema = z.object({
  expectedSettings: z.record(z.unknown()),
  requestId: z.string().uuid(),
}).strict()

const optionalSettingText = (max: number) => z.string().trim().max(max)
const businessTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Geçersiz saat')
const businessIntervalSchema = z.object({ open: businessTimeSchema, close: businessTimeSchema }).strict()
const businessDaySchema = z.object({
  open: businessTimeSchema,
  close: businessTimeSchema,
  active: z.boolean(),
  intervals: z.array(businessIntervalSchema).min(1).max(3).optional(),
}).strict()
const businessHoursSchema = z.object({
  mon: businessDaySchema,
  tue: businessDaySchema,
  wed: businessDaySchema,
  thu: businessDaySchema,
  fri: businessDaySchema,
  sat: businessDaySchema,
  sun: businessDaySchema,
}).strict()
const contactSettingsPatchSchema = z.object({
  contact: z.object({
    phone: optionalSettingText(30),
    email: z.union([z.literal(''), z.string().trim().email().max(320)]),
    website: optionalSettingText(255),
    address: optionalSettingText(500),
    district: optionalSettingText(100),
    city: optionalSettingText(100),
    zip: optionalSettingText(20),
    instagram: optionalSettingText(100),
    facebook: optionalSettingText(150),
    tiktok: optionalSettingText(100),
    whatsapp: optionalSettingText(30),
  }).strict(),
}).strict()
const taxSettingsPatchSchema = z.object({
  tax: z.object({
    company: optionalSettingText(200),
    taxNumber: optionalSettingText(32),
    office: optionalSettingText(100),
    tcVkn: optionalSettingText(32),
    address: optionalSettingText(500),
  }).strict(),
}).strict()
const genericSettingsPatchSchema = z.union([
  contactSettingsPatchSchema,
  taxSettingsPatchSchema,
  z.object({ hours: businessHoursSchema }).strict(),
])

export type GenericSettingsPatch = z.infer<typeof genericSettingsPatchSchema>

export async function updateRestaurantTimezone(
  restaurantId: string,
  input: unknown,
): Promise<{ error: string; code?: 'CONFLICT' } | { success: true; timezone: string; idempotent: boolean }> {
  const parsedRestaurantId = z.string().uuid().safeParse(restaurantId)
  const parsed = timezoneUpdateSchema.safeParse(input)
  if (!parsedRestaurantId.success || !parsed.success) return { error: 'Geçerli bir zaman dilimi seçin.' }
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const result = await updateRestaurantTimezoneCas({
    restaurantId,
    actorUserId: gate.userId,
    timezone: parsed.data.timezone,
    expectedTimezone: parsed.data.expectedTimezone,
    requestId: parsed.data.requestId,
  })
  if (!result.ok) return { error: 'Zaman dilimi kaydedilemedi.' }
  if (result.value.outcome === 'applied') {
    revalidatePath(`/dashboard/${restaurantId}/settings`)
    return { success: true, timezone: result.value.timezone, idempotent: result.value.idempotent }
  }
  return { error: 'Zaman dilimi başka bir oturumda değiştirildi.', code: 'CONFLICT' }
}

export interface SettingsWriteGuard {
  expectedSettings: Record<string, unknown>
  requestId: string
}

export type SettingsActionResult =
  | { error: string; code?: 'CONFLICT'; canonicalSettings?: Record<string, unknown> }
  | { success: true; canonicalSettings: Record<string, unknown>; idempotent: boolean }

function settingsActionResult(result: { ok: true; value: RestaurantSettingsPatchResult } | { ok: false; error: string }): SettingsActionResult {
  if (!result.ok) {
    return {
      error: result.error === 'Settings request conflicts with an earlier attempt'
        ? 'Bu kayıt isteği daha önce farklı bir içerikle kullanıldı. Değişikliklerini kontrol edip tekrar dene.'
        : 'Ayarlar kaydedilemedi. Lütfen tekrar dene.',
    }
  }
  if (result.value.outcome === 'conflict') {
    return {
      error: 'Bu ayarlar başka bir sekmede değiştirildi. Taslağını koruduk; güncel değerleri görmek için sayfayı yenile.',
      code: 'CONFLICT',
      canonicalSettings: result.value.settings,
    }
  }
  return {
    success: true,
    canonicalSettings: result.value.settings,
    idempotent: result.value.idempotent,
  }
}

function getActionErrorMessage(error: unknown, fallback: string) {
  console.error('[restaurant-action-failure]', sanitizeServerDiagnostic(error))
  return fallback
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
    planIntent: formData.get('planIntent') || null,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: 'create_restaurant_with_pro_trial',
    args: { p_name: string; p_slug: string; p_intended_plan: 'starter' | 'plus' | 'pro' | null },
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>
  const { data, error } = await rpc('create_restaurant_with_pro_trial', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_intended_plan: parsed.data.planIntent,
  })

  if (error) {
    if (error.code === '23505') return { error: 'That slug is already taken' }
    console.error('[restaurant-create-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Restoran oluşturulamadı. Lütfen tekrar deneyin.' }
  }

  const id = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as { restaurantId?: unknown }).restaurantId
    : null
  if (typeof id !== 'string') return { error: 'Failed to create restaurant' }

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
  const ownerGate = await assertOwner(id)
  if ('error' in ownerGate) return ownerGate
  const planGate = await assertRestaurantFeature(id, 'qr_menu')
  if ('error' in planGate) return planGate
  const { error } = await mut(supabase, 'restaurants')
    .update(updates as Record<string, unknown>)
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'That slug is already taken' }
    console.error('[restaurant-update-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Restoran bilgileri güncellenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/dashboard/${id}`)
  revalidatePath(`/dashboard/${id}/settings`)
  return { success: true }
}

export async function updateSettings(
  restaurantId: string,
  settings: unknown,
  guard: SettingsWriteGuard,
): Promise<SettingsActionResult> {
  const parsedSettings = genericSettingsPatchSchema.safeParse(settings)
  if (!parsedSettings.success) return { error: 'Geçersiz veya desteklenmeyen ayar alanı' }
  const parsedGuard = settingsWriteGuardSchema.safeParse(guard)
  if (!parsedGuard.success) return { error: 'Geçersiz ayar kayıt isteği' }
  const { user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access || (!access.isOwner && !access.permissions.includes('settings'))) {
    return { error: 'Not authorized' }
  }
  const planGate = await assertRestaurantFeature(restaurantId, 'qr_menu')
  if ('error' in planGate) return planGate
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
      patch: parsedSettings.data,
      expectedSettings: parsedGuard.data.expectedSettings,
      requestId: parsedGuard.data.requestId,
    },
    createRestaurantSettingsPort(),
  )
  const response = settingsActionResult(result)
  if ('error' in response) return response

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return response
}

// Notification channel prefs → restaurants.settings.notifications (JSONB).
// Zod-validated shape; only the four real channels are accepted.
const notificationPrefsSchema = z.object({
  newOrderSound: z.boolean(),
  newOrderSoundPreset: z.enum(['classic', 'kitchen-bell', 'double-chime', 'soft-ping']),
  newOrderSoundVolume: z.number().int().min(0).max(100),
  newOrderRepeatSeconds: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]),
  newOrderRepeatMaxMinutes: z.number().int().min(1).max(10),
  newOrderPush: z.boolean(),
  newOrderToast: z.boolean(),
  serviceRequestAlert: z.boolean(),
  serviceRequestPush: z.boolean(),
})

const notificationSettingsSchema = z.object({
  prefs: notificationPrefsSchema,
  lateThresholdMin: z.number().int().min(5).max(120),
})

/**
 * The current hours model represents one same-day interval per weekday. Reject
 * malformed and overnight intervals rather than publishing an ambiguous menu
 * state; split/overnight schedules need their own data-model epic.
 */
export async function saveBusinessHours(
  restaurantId: string,
  hours: unknown,
  guard: SettingsWriteGuard,
): Promise<SettingsActionResult> {
  const parsed = businessHoursSchema.safeParse(hours)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Geçersiz çalışma saatleri' }
  }
  return updateSettings(restaurantId, { hours: parsed.data }, guard)
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
  guard: SettingsWriteGuard,
): Promise<SettingsActionResult | DashboardActionFailure> {
  const parsed = notificationSettingsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Geçersiz bildirim ayarları' }
  const parsedGuard = settingsWriteGuardSchema.safeParse(guard)
  if (!parsedGuard.success) return { error: 'Geçersiz ayar kayıt isteği' }

  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access || (!access.isOwner && !access.permissions.includes('settings'))) {
    return { error: 'Not authorized' }
  }
  const subscriptionGate = await assertRestaurantFeature(restaurantId, 'staff_orders')
  if ('error' in subscriptionGate) return subscriptionGate
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
    && !await canRestaurantUseFeature({ restaurantId, plan: restaurantPlan, feature: 'browser_notifications' })
  ) {
    return dashboardActionFailure('PLAN_REQUIRED', {
      operation: 'notifications.settings.save',
      message: 'Masaüstü bildirimleri Pro paketiyle kullanılabilir.',
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
      expectedSettings: parsedGuard.data.expectedSettings,
      requestId: parsedGuard.data.requestId,
    },
    createRestaurantSettingsPort(),
  )
  const response = settingsActionResult(result)
  if ('error' in response) return response

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  // Orders board + shell read prefs from the restaurant row on next load.
  revalidatePath(`/dashboard/${restaurantId}`, 'layout')
  return response
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
  const planGate = await assertRestaurantFeature(restaurantId, 'loyalty')
  if ('error' in planGate) return planGate

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
  guard: SettingsWriteGuard,
): Promise<SettingsActionResult> {
  const parsedGuard = settingsWriteGuardSchema.safeParse(guard)
  if (!parsedGuard.success) return { error: 'Geçersiz ayar kayıt isteği' }
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
  if (!restaurant || !await canRestaurantUseFeature({
    restaurantId,
    plan: (restaurant as { plan?: unknown }).plan,
    feature: 'loyalty',
  })) {
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
    {
      restaurantId,
      patch: { loyalty: cfg },
      expectedSettings: parsedGuard.data.expectedSettings,
      requestId: parsedGuard.data.requestId,
    },
    createRestaurantSettingsPort(),
  )
  const response = settingsActionResult(result)
  if ('error' in response) return response

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return response
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
  const ownerGate = await assertOwner(restaurantId)
  if ('error' in ownerGate) return ownerGate
  const planGate = await assertRestaurantFeature(restaurantId, 'theme_editor')
  if ('error' in planGate) return planGate
  const { error } = await mut(supabase, 'restaurants')
    .update({ logo_url: null })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
  if (error) {
    console.error('[restaurant-logo-remove-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Logo kaldırılamadı. Lütfen tekrar deneyin.' }
  }
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

  if (!z.string().uuid().safeParse(restaurantId).success) return { error: 'Geçersiz restoran.' }
  const { data: ownedRestaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!ownedRestaurant) return { error: 'Not authorized' }
  const planGate = await assertRestaurantFeature(restaurantId, 'theme_editor')
  if ('error' in planGate) return planGate

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Logo dosyası bulunamadı.' }
  const metadata = validateLogoImageMetadata({ size: file.size, type: file.type })
  if (!metadata.ok) return { error: metadata.error }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const inspected = inspectLogoImage(bytes, file.type)
  if (!inspected.ok) return { error: inspected.error }

  const path = `${user.id}/${restaurantId}/logo-${crypto.randomUUID()}.${inspected.image.extension}`

  const assetStorage = createRestaurantAssetStoragePort()
  let publicUrl: string
  try {
    const stored = await assetStorage.uploadImmutable({
      path,
      bytes,
      contentType: inspected.image.mime,
    })
    publicUrl = stored.publicUrl
  } catch (error) {
    console.error('[restaurant-logo-upload-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Logo yüklenemedi. Lütfen tekrar deneyin.' }
  }

  const { data: updatedRows, error: updateError } = await mut(supabase, 'restaurants')
    .update({ logo_url: publicUrl })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .select('id')

  // Storage upload and restaurant metadata must either both succeed or report a
  // failure. Roll back the new object when the owner-scoped row update did not
  // land so the UI never claims that a logo was saved when it was not.
  if (updateError || !updatedRows?.length) {
    try {
      await assetStorage.remove(path)
    } catch (cleanupError) {
      console.error('[restaurant-logo-cleanup-failure]', sanitizeServerDiagnostic(cleanupError))
    }
    if (updateError) console.error('[restaurant-logo-update-failure]', sanitizeServerDiagnostic(updateError))
    return { error: 'Logo güncellenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/dashboard/${restaurantId}`)
  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return { url: publicUrl }
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
    const planGate = await assertRestaurantFeature(parsed.data.restaurantId, 'kitchen_display')
    if ('error' in planGate) return planGate

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
    if (error) {
      console.error('[kitchen-station-create-failure]', sanitizeServerDiagnostic(error))
      return { error: 'Mutfak istasyonu oluşturulamadı.' }
    }
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
    const planGate = await assertRestaurantFeature(parsed.data.restaurantId, 'kitchen_display')
    if ('error' in planGate) return planGate

    const { id, restaurantId, ...updates } = parsed.data
    const { data, error } = await mut(gate.supabase, 'kitchen_stations')
      .update(updates)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select('*')
    if (error) {
      console.error('[kitchen-station-update-failure]', sanitizeServerDiagnostic(error))
      return { error: 'Mutfak istasyonu güncellenemedi.' }
    }
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
    const planGate = await assertRestaurantFeature(parsedRestaurantId.data, 'kitchen_display')
    if ('error' in planGate) return planGate
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
  currentPassword?: string,
): Promise<{ error: string } | { success: true }> {
  const parsedRestaurantId = z.string().uuid().safeParse(restaurantId)
  if (!parsedRestaurantId.success) return { error: 'Invalid input' }
  const hasExistingCredential = await hasKitchenCredential(parsedRestaurantId.data)
  const gate = hasExistingCredential
    ? await requireFreshOwnerPassword(parsedRestaurantId.data, currentPassword ?? '')
    : await assertOwner(parsedRestaurantId.data)
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
