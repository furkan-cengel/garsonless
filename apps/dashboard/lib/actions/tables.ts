'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { creditVisitsForSession } from '@garsonless/db'

const createTableSchema = z.object({
  restaurantId: z.string().uuid(),
  label: z.string().min(1).max(50),
})

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function assertRestaurantOwner(
  supabase: Awaited<ReturnType<typeof createDashboardServerClient>>,
  restaurantId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .single()
  return !!data
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

/** Close the adisyon (confirmed client-side; unpaid orders allowed with override). */
export async function closeTableSession(
  sessionId: string,
  restaurantId: string,
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

  const { error } = await mut(supabase, 'table_sessions')
    .update({ closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('restaurant_id', restaurantId)
    .is('closed_at', null)

  if (error) return { error: error.message }

  // Credit +1 visit to each member who ordered in this session (idempotent,
  // best-effort — never blocks the close).
  await creditVisitsForSession(sessionId)

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}

/* QR generation/styling were dashboard server actions that no callers used —
   the Tables/QR builder renders + downloads QR client-side via qr-code-styling
   and persists style through updateSettings. Removed with their QRStyleOptions
   type in the dead-code cleanup. */
