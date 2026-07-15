'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { closeTableSession as closeTableSessionCommand, listOpenTableSessions } from '@garsonless/application/tables'
import {
  createTableSessionPort,
  listActiveTableQrTokens,
  patchRestaurantQrStyle,
  readRestaurantSlug,
  rotateActiveTableQrToken,
  softDeleteTable,
} from '@garsonless/db/server'
import { assertAccess } from '../auth/access'

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  label: z.string().trim().min(1).max(50),
})

const updateTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
  label: z.string().trim().min(1).max(50),
})

const deleteTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
})

const rotateTableQrTokenSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
})

const qrStyleSchema = z.object({
  dotsType: z.string().min(1).max(40),
  eyeFrame: z.string().min(1).max(40),
  eyeBall: z.string().min(1).max(40),
  size: z.number().int().min(200).max(2000),
  margin: z.number().int().min(0).max(80),
  ecl: z.enum(['L', 'M', 'Q', 'H']),
  colorType: z.enum(['single', 'gradient']),
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fg2: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  gradType: z.enum(['linear', 'radial']),
  gradAngle: z.number().int().min(0).max(360),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bgTransparent: z.boolean(),
  // Hard cap: the logo rides inside restaurants.settings, which is read on
  // every dashboard SSR (and the public menu reads the row), so a multi-MB
  // base64 blob would bloat those payloads. The client downscales raster logos
  // to <=256px PNG before upload; this is the server backstop. ~256KB of base64.
  logo: z.string().max(262_144).nullable(),
  logoSize: z.number().min(0).max(1),
  logoMargin: z.number().int().min(0).max(80),
  logoHideBg: z.boolean(),
  frame: z.string().min(1).max(40),
  frameTitle: z.string().max(80),
  frameSubtitle: z.string().max(140),
  frameColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  baseUrl: z.string().min(1).max(200),
  utmSource: z.string().max(80),
  utmMedium: z.string().max(80),
  utmCampaign: z.string().max(120),
  autoLang: z.boolean(),
  countdown: z.boolean(),
  _presetId: z.string().max(60).optional(),
})

const PRODUCTION_MENU_ORIGIN = 'https://menu.masabu.co'
const MENU_ORIGIN = (
  process.env.NODE_ENV === 'production'
    ? PRODUCTION_MENU_ORIGIN
    : process.env.NEXT_PUBLIC_MENU_BASE_URL ?? process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
).replace(/\/+$/, '')

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// Phase 3 section gate: owner OR a member with the 'tables' section.
async function assertRestaurantOwner(
  _supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  _userId: string,
) {
  const gate = await assertAccess(restaurantId, 'tables')
  return !('error' in gate)
}

export async function createTable(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { id: string; token: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = createTableSchema.safeParse({
    restaurantId: formData.get('restaurantId'),
    label: formData.get('label'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data: duplicate } = await supabase
    .from('tables')
    .select('id')
    .eq('restaurant_id', parsed.data.restaurantId)
    .ilike('label', parsed.data.label)
    .is('deleted_at', null)
    .limit(1)
  if ((duplicate ?? []).length > 0) return { error: 'Bu isimde aktif bir masa zaten var.' }

  const { data, error } = await mut(supabase, 'tables')
    .insert({ restaurant_id: parsed.data.restaurantId, label: parsed.data.label })
    .select('id')
    .single()

  if (error) return { error: error.code === '23505' ? 'Bu isimde aktif bir masa zaten var.' : error.message }

  const id = (data as { id: string } | null)?.id
  if (!id) return { error: 'Failed to create table' }

  const tokens = await listActiveTableQrTokens(parsed.data.restaurantId)
  const token = tokens[id]
  if (!token) return { error: 'Yeni masa için QR bağlantısı oluşturulamadı.' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { id, token }
}

export async function renameTable(
  input: unknown,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = updateTableSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data: duplicate } = await supabase
    .from('tables')
    .select('id')
    .eq('restaurant_id', parsed.data.restaurantId)
    .neq('id', parsed.data.tableId)
    .ilike('label', parsed.data.label)
    .is('deleted_at', null)
    .limit(1)
  if ((duplicate ?? []).length > 0) return { error: 'Bu isimde aktif bir masa zaten var.' }

  const now = new Date().toISOString()
  const { data, error } = await mut(supabase, 'tables')
    .update({ label: parsed.data.label, updated_at: now })
    .eq('id', parsed.data.tableId)
    .eq('restaurant_id', parsed.data.restaurantId)
    .is('deleted_at', null)
    .select('id')

  if (error) return { error: error.code === '23505' ? 'Bu isimde aktif bir masa zaten var.' : error.message }
  if (!data || data.length === 0) return { error: 'Table not found for this restaurant' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { success: true }
}

export async function deleteTable(
  input: unknown,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const parsed = deleteTableSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const isOwner = await assertRestaurantOwner(supabase, parsed.data.restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data: outcome, error } = await softDeleteTable(parsed.data)

  if (error) return { error: error.message }
  if (outcome === 'open_session') return { error: 'Bu masada açık adisyon var. Önce adisyonu kapatın.' }
  if (outcome !== 'deleted') return { error: 'Table not found for this restaurant' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { success: true }
}

/** Revoke the current public QR credential and issue a replacement atomically. */
export async function rotateTableQrToken(input: unknown): Promise<{ error: string } | { token: string }> {
  const parsed = rotateTableQrTokenSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid QR rotation request' }
  const gate = await assertAccess(parsed.data.restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }
  try {
    const token = await rotateActiveTableQrToken({
      restaurantId: parsed.data.restaurantId,
      tableId: parsed.data.tableId,
      revokedBy: gate.userId,
    })
    if (!token) return { error: 'Masa bulunamadı veya artık aktif değil.' }
    revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
    return { token }
  } catch {
    return { error: 'QR kodu döndürülemedi. Lütfen tekrar deneyin.' }
  }
}

export async function saveQRStyle(
  restaurantId: string,
  style: unknown,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: 'Not authorized' }

  const parsed = qrStyleSchema.safeParse(style)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid QR style' }

  let slug: string | null
  try {
    slug = await readRestaurantSlug(restaurantId)
  } catch {
    return { error: 'Restaurant could not be loaded' }
  }
  if (!slug) return { error: 'Restaurant not found' }

  const expectedBaseUrl = `${MENU_ORIGIN}/${slug}`
  if (parsed.data.baseUrl !== expectedBaseUrl) {
    return { error: 'QR menu address cannot be changed' }
  }

  // Atomic JSONB patch: updating QR Studio can no longer overwrite a theme,
  // notification or loyalty setting saved concurrently by another screen.
  // The RPC is service-role only; this action's section gate remains the
  // user-facing authorization boundary.
  const result = await patchRestaurantQrStyle(restaurantId, parsed.data)
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}

export type OpenSessionInfo = import('@garsonless/application/tables').OpenTableSession

/** Open sessions with totals for every table of the restaurant. */
export async function getOpenTableSessions(
  restaurantId: string,
): Promise<OpenSessionInfo[] | { error: string }> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }
  const result = await listOpenTableSessions(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    restaurantId,
    createTableSessionPort(),
  )
  return result.ok ? result.value : { error: result.error }
}

/**
 * Close the adisyon — P2: NO path closes unpaid money silently.
 *
 *  - Fully paid (no unpaid non-cancelled order) → NORMAL close: closed_at set,
 *    close_reason stays null, +1 visit credited. This is now a fallback: the
 *    common path is the UI settling each order via settleOrder, whose last
 *    settle auto-closes the session (P1).
 *  - Unpaid orders remain + NO abnormalReason → REJECTED. The caller must settle
 *    (settlement sheet) or make an explicit abnormal decision. This is the
 *    money-drop guard.
 *  - Unpaid orders remain + abnormalReason given → ABNORMAL close (walkout/
 *    dispute): closed_at set, close_reason recorded, the unpaid orders STAY
 *    unpaid, and NO visit is credited (no completed paid visit).
 */
export async function closeTableSession(
  sessionId: string,
  restaurantId: string,
  opts?: { abnormalReason?: string },
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }
  const result = await closeTableSessionCommand(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    { sessionId, restaurantId, abnormalReason: opts?.abnormalReason },
    createTableSessionPort(),
  )
  if (!result.ok) return { error: result.error }
  const outcome = result.value
  if (outcome === 'not_found') return { error: 'Session not found for this restaurant' }
  if (outcome === 'unpaid') return { error: 'Ödenmemiş sipariş var — önce tahsil edin ya da bir sebeple anormal kapatın.' }
  if (outcome === 'already_closed') return { success: true }
  if (outcome !== 'closed_normal' && outcome !== 'closed_abnormal') return { error: 'Adisyon kapatılamadı.' }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}

/* QR generation/styling were dashboard server actions that no callers used —
   the Tables/QR builder renders + downloads QR client-side via qr-code-styling
   and persists style through updateSettings. Removed with their QRStyleOptions
   type in the dead-code cleanup. */
