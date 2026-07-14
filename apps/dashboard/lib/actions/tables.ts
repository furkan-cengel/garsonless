'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { createServiceClient, creditVisitsForSession, voidDeclaredSharesForSession } from '@garsonless/db'
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
): Promise<{ error: string } | { id: string }> {
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

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { id }
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

  const svc = createServiceClient()
  const atomicDelete = svc.rpc.bind(svc) as unknown as (
    fn: 'soft_delete_table_atomic',
    args: { p_table_id: string; p_restaurant_id: string },
  ) => Promise<{ data: string | null; error: { message: string } | null }>
  const { data: outcome, error } = await atomicDelete('soft_delete_table_atomic', {
    p_table_id: parsed.data.tableId,
    p_restaurant_id: parsed.data.restaurantId,
  })

  if (error) return { error: error.message }
  if (outcome === 'open_session') return { error: 'Bu masada açık adisyon var. Önce adisyonu kapatın.' }
  if (outcome !== 'deleted') return { error: 'Table not found for this restaurant' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { success: true }
}

export async function saveQRStyle(
  restaurantId: string,
  style: unknown,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: 'Not authorized' }

  const parsed = qrStyleSchema.safeParse(style)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid QR style' }

  const svc = createServiceClient()
  const { data: existing } = await svc
    .from('restaurants')
    .select('slug')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) return { error: 'Restaurant not found' }

  const expectedBaseUrl = `${MENU_ORIGIN}/${existing.slug}`
  if (parsed.data.baseUrl !== expectedBaseUrl) {
    return { error: 'QR menu address cannot be changed' }
  }

  // Atomic JSONB patch: updating QR Studio can no longer overwrite a theme,
  // notification or loyalty setting saved concurrently by another screen.
  // The RPC is service-role only; this action's section gate remains the
  // user-facing authorization boundary.
  const { error } = await svc.rpc('patch_restaurant_qr_style', {
    p_restaurant_id: restaurantId,
    p_qr_style: parsed.data,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}

export interface OpenSessionInfo {
  sessionId: string
  tableId: string
  openedAt: string
  total: number
  unpaidTotal: number
  splitSettledTotal: number
  splitDeclaredCashTotal: number
  orderCount: number
  hasUnfinished: boolean
}

/** Open sessions with totals for every table of the restaurant. */
export async function getOpenTableSessions(
  restaurantId: string,
): Promise<OpenSessionInfo[] | { error: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data: sessions, error: sessionsError } = await supabase
    .from('table_sessions')
    .select('id, table_id, opened_at')
    .eq('restaurant_id', restaurantId)
    .is('closed_at', null)

  if (sessionsError) return { error: `Açık adisyonlar yüklenemedi: ${sessionsError.message}` }
  const sessionRows = (sessions ?? []) as Array<{ id: string; table_id: string; opened_at: string }>
  if (sessionRows.length === 0) return []

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('table_session_id, total, status, paid_at')
    .in('table_session_id', sessionRows.map((s) => s.id))
    .is('deleted_at', null)

  if (ordersError) return { error: `Sipariş toplamları yüklenemedi: ${ordersError.message}` }
  const orderRows = (orders ?? []) as Array<{
    table_session_id: string; total: number; status: string; paid_at: string | null
  }>
  const svc = createServiceClient()
  const { data: shares, error: sharesError } = await svc
    .from('payment_shares')
    .select('table_session_id, amount, method, status')
    .in('table_session_id', sessionRows.map((s) => s.id))
    .eq('restaurant_id', restaurantId)
    .neq('status', 'void')
  if (sharesError) return { error: `Ödeme payları yüklenemedi: ${sharesError.message}` }
  const shareRows = (shares ?? []) as Array<{
    table_session_id: string
    amount: number | null
    method: string | null
    status: string
  }>

  return sessionRows.map((session) => {
    const sessionOrders = orderRows.filter((o) => o.table_session_id === session.id)
    const active = sessionOrders.filter((o) => o.status !== 'cancelled')
    const total = active.reduce((sum, o) => sum + Number(o.total), 0)
    const unpaidTotal = active
      .filter((o) => o.paid_at === null)
      .reduce((sum, o) => sum + Number(o.total), 0)
    const sessionShares = shareRows.filter((share) => share.table_session_id === session.id)
    const splitSettledTotal = sessionShares
      .filter((share) => share.status === 'settled')
      .reduce((sum, share) => sum + Number(share.amount ?? 0), 0)
    const splitDeclaredCashTotal = sessionShares
      .filter((share) => share.status === 'declared' && share.method === 'cash')
      .reduce((sum, share) => sum + Number(share.amount ?? 0), 0)
    return {
      sessionId: session.id,
      tableId: session.table_id,
      openedAt: session.opened_at,
      total,
      unpaidTotal,
      splitSettledTotal,
      splitDeclaredCashTotal,
      orderCount: active.length,
      hasUnfinished: active.some((o) => o.status !== 'served'),
    }
  })
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
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const reason = opts?.abnormalReason?.trim()
  const svc = createServiceClient()
  const atomicClose = svc.rpc.bind(svc) as unknown as (
    fn: 'close_table_session_atomic',
    args: { p_session_id: string; p_restaurant_id: string; p_abnormal_reason: string | null },
  ) => Promise<{ data: string | null; error: { message: string } | null }>
  const { data: outcome, error } = await atomicClose('close_table_session_atomic', {
    p_session_id: sessionId,
    p_restaurant_id: restaurantId,
    p_abnormal_reason: reason || null,
  })

  if (error) return { error: error.message }
  if (outcome === 'not_found') return { error: 'Session not found for this restaurant' }
  if (outcome === 'unpaid') return { error: 'Ödenmemiş sipariş var — önce tahsil edin ya da bir sebeple anormal kapatın.' }
  if (outcome === 'already_closed') return { success: true }
  if (outcome !== 'closed_normal' && outcome !== 'closed_abnormal') return { error: 'Adisyon kapatılamadı.' }

  const abnormal = outcome === 'closed_abnormal'

  // Visits are a completed-paid-visit signal — credit ONLY on a normal close.
  // An abnormal close (unpaid money abandoned) must not mint loyalty visits.
  if (!abnormal) {
    await creditVisitsForSession(sessionId)
  } else {
    // Abnormal close = money still owed. Void any DECLARED (unconfirmed) split
    // shares — they'll never be paid. SETTLED shares (real money) stay intact;
    // the close_reason is the audit record (no parallel mechanism, no silent drop).
    await voidDeclaredSharesForSession(sessionId, restaurantId)
  }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}

/* QR generation/styling were dashboard server actions that no callers used —
   the Tables/QR builder renders + downloads QR client-side via qr-code-styling
   and persists style through updateSettings. Removed with their QRStyleOptions
   type in the dead-code cleanup. */
