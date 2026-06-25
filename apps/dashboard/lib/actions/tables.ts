'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { creditVisitsForSession } from '@garsonless/db'
import { assertAccess } from '../auth/access'

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  label: z.string().min(1).max(50),
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
