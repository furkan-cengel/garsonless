'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { slugify } from '../utils'
import { sanitizeTiers } from '@garsonless/db'

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

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
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

const aiSettingsSchema = z.object({
  restaurantId: z.string().uuid(),
  ai_waiter_enabled: z.boolean(),
  ai_persona_name: z.string().min(1).max(50),
  ai_tone: z.enum(['formal', 'friendly', 'playful']),
  ai_language: z.enum(['tr', 'en', 'both']),
})

export async function updateAISettings(
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = aiSettingsSchema.safeParse({
    restaurantId: formData.get('restaurantId'),
    ai_waiter_enabled: formData.get('ai_waiter_enabled') === 'true',
    ai_persona_name: formData.get('ai_persona_name'),
    ai_tone: formData.get('ai_tone'),
    ai_language: formData.get('ai_language'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { restaurantId, ...aiFields } = parsed.data

  const { data: existing } = await supabase
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!existing) return { error: 'Not authorized' }

  const mergedSettings = {
    ...((existing as { settings: Record<string, unknown> }).settings ?? {}),
    ...aiFields,
  }

  const { error } = await mut(supabase, 'restaurants')
    .update({ settings: mergedSettings })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function updateSettings(
  restaurantId: string,
  settings: Record<string, unknown>,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!existing) return { error: 'Not authorized' }

  const merged = {
    ...((existing as { settings: Record<string, unknown> }).settings ?? {}),
    ...settings,
  }

  const { error } = await mut(supabase, 'restaurants')
    .update({ settings: merged })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
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

  const { data: existing } = await supabase
    .from('restaurants').select('settings').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!existing) return { error: 'Not authorized' }

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

  const merged = { ...((existing as { settings: Record<string, unknown> }).settings ?? {}), loyalty: cfg }
  const { error } = await mut(supabase, 'restaurants')
    .update({ settings: merged }).eq('id', restaurantId).eq('owner_id', user.id)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  revalidateTag(`menu:${restaurantId}`)
  return { success: true }
}

export async function generateApiKey(
  restaurantId: string,
): Promise<{ error: string } | { key: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const key =
    'sk_live_' +
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

  const { data: existing } = await supabase
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!existing) return { error: 'Not authorized' }

  const merged = {
    ...((existing as { settings: Record<string, unknown> }).settings ?? {}),
    api_key: key,
  }

  const { error } = await mut(supabase, 'restaurants')
    .update({ settings: merged })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { key }
}

export async function patchRestaurantName(
  restaurantId: string,
  name: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = z.string().min(1).max(100).safeParse(name)
  if (!parsed.success) return { error: 'Invalid name' }

  const { error } = await mut(supabase, 'restaurants')
    .update({ name: parsed.data })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}`)
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

  await mut(supabase, 'restaurants')
    .update({ logo_url: data.publicUrl })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  revalidatePath(`/dashboard/${restaurantId}`)
  return { url: data.publicUrl }
}

export async function generateKitchenToken(
  restaurantId: string,
): Promise<{ error: string } | { token: string; kitchenUrl: string; qrDataUrl: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return { error: 'Not authorized' }

  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // GAP #1: the kitchen token is a secret — store it in the service-role-only
  // kitchen_credentials table, NOT in the anon-readable restaurants.settings.
  // The RLS owner policy gates this write to the owner's own restaurant.
  const { error } = await mut(supabase, 'kitchen_credentials')
    .upsert({ restaurant_id: restaurantId, token, updated_at: new Date().toISOString() }, { onConflict: 'restaurant_id' })

  if (error) return { error: error.message }

  const kitchenUrl = `${process.env['NEXT_PUBLIC_KITCHEN_URL'] ?? 'http://localhost:3002'}/kitchen/${restaurantId}?token=${token}`

  const { generateQRDataURL } = await import('@garsonless/qr')
  const qrDataUrl = await generateQRDataURL({ url: kitchenUrl, size: 256 })

  revalidatePath(`/dashboard/${restaurantId}/settings`)
  return { token, kitchenUrl, qrDataUrl }
}
