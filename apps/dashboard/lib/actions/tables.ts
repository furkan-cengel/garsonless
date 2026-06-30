'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { createServiceClient, creditVisitsForSession, type Json } from '@garsonless/db'
import { assertAccess } from '../auth/access'

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  label: z.string().min(1).max(50),
})

const updateTableSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid(),
  label: z.string().min(1).max(50),
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

  const { data, error } = await mut(supabase, 'tables')
    .insert({ restaurant_id: parsed.data.restaurantId, label: parsed.data.label })
    .select('id')
    .single()

  if (error) return { error: error.message }

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

  const now = new Date().toISOString()
  const { data, error } = await mut(supabase, 'tables')
    .update({ label: parsed.data.label, updated_at: now })
    .eq('id', parsed.data.tableId)
    .eq('restaurant_id', parsed.data.restaurantId)
    .is('deleted_at', null)
    .select('id')

  if (error) return { error: error.message }
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

  const { data: openRows } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', parsed.data.restaurantId)
    .eq('table_id', parsed.data.tableId)
    .is('closed_at', null)
    .limit(1)

  if ((openRows ?? []).length > 0) {
    return { error: 'Bu masada açık adisyon var. Önce adisyonu kapatın.' }
  }

  const now = new Date().toISOString()
  const { data, error } = await mut(supabase, 'tables')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', parsed.data.tableId)
    .eq('restaurant_id', parsed.data.restaurantId)
    .is('deleted_at', null)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Table not found for this restaurant' }

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
    .select('settings')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) return { error: 'Restaurant not found' }

  const merged = {
    ...((existing as { settings: Record<string, unknown> | null }).settings ?? {}),
    qr_style: parsed.data,
  }

  const { error } = await svc
    .from('restaurants')
    .update({ settings: merged as Json })
    .eq('id', restaurantId)

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

  const { data: sessions } = await supabase
    .from('table_sessions')
    .select('id, table_id, opened_at')
    .eq('restaurant_id', restaurantId)
    .is('closed_at', null)

  const sessionRows = (sessions ?? []) as Array<{ id: string; table_id: string; opened_at: string }>
  if (sessionRows.length === 0) return []

  const { data: orders } = await supabase
    .from('orders')
    .select('table_session_id, total, status, paid_at')
    .in('table_session_id', sessionRows.map((s) => s.id))
    .is('deleted_at', null)

  const orderRows = (orders ?? []) as Array<{
    table_session_id: string; total: number; status: string; paid_at: string | null
  }>

  return sessionRows.map((session) => {
    const sessionOrders = orderRows.filter((o) => o.table_session_id === session.id)
    const active = sessionOrders.filter((o) => o.status !== 'cancelled')
    const total = active.reduce((sum, o) => sum + Number(o.total), 0)
    const unpaidTotal = active
      .filter((o) => o.paid_at === null)
      .reduce((sum, o) => sum + Number(o.total), 0)
    return {
      sessionId: session.id,
      tableId: session.table_id,
      openedAt: session.opened_at,
      total,
      unpaidTotal,
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

  const { data: session } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('restaurant_id', restaurantId)
    .is('closed_at', null)
    .maybeSingle()

  if (!session) return { error: 'Session not found for this restaurant' }

  // Is there unpaid non-cancelled money still on this adisyon?
  const { data: orderRows } = await supabase
    .from('orders')
    .select('paid_at')
    .eq('restaurant_id', restaurantId)
    .eq('table_session_id', sessionId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  const hasUnpaid = ((orderRows ?? []) as Array<{ paid_at: string | null }>)
    .some((o) => o.paid_at === null)

  const reason = opts?.abnormalReason?.trim()
  // Abnormal = closing while money is still owed (the recorded-decision path).
  const abnormal = hasUnpaid

  if (hasUnpaid && !reason) {
    // The no-silent-drop guard: closing money-owing adisyon needs an explicit,
    // recorded decision. The UI settles first; this rejects a bare close.
    return { error: 'Ödenmemiş sipariş var — önce tahsil edin ya da bir sebeple anormal kapatın.' }
  }

  // close_reason is written ONLY on the abnormal path. A normal (fully-paid)
  // close leaves it untouched (the column defaults null), so the common close
  // stays independent of the close_reason migration's deploy timing.
  const updateRow: Record<string, unknown> = {
    closed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (abnormal) updateRow.close_reason = (reason ?? '').slice(0, 200)

  // Race-safe: the `is('closed_at', null)` guard means a concurrent auto-close
  // (P1) that already closed this session as fully-paid wins — we overwrite
  // nothing (0 rows) and no-op cleanly.
  const { error } = await mut(supabase, 'table_sessions')
    .update(updateRow)
    .eq('id', sessionId)
    .eq('restaurant_id', restaurantId)
    .is('closed_at', null)

  if (error) return { error: error.message }

  // Visits are a completed-paid-visit signal — credit ONLY on a normal close.
  // An abnormal close (unpaid money abandoned) must not mint loyalty visits.
  if (!abnormal) {
    await creditVisitsForSession(sessionId)
  }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}

/* QR generation/styling were dashboard server actions that no callers used —
   the Tables/QR builder renders + downloads QR client-side via qr-code-styling
   and persists style through updateSettings. Removed with their QRStyleOptions
   type in the dead-code cleanup. */
