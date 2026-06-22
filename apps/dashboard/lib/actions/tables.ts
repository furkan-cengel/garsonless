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

export async function deleteTable(
  tableId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { error } = await mut(supabase, 'tables')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }

  // A soft-deleted table must not keep an open adisyon alive. Grab the open
  // session first so we can credit visits for it after closing.
  const { data: openSess } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .is('closed_at', null)
    .maybeSingle()
  await mut(supabase, 'table_sessions')
    .update({ closed_at: new Date().toISOString() })
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .is('closed_at', null)
  const closedSessionId = (openSess as { id: string } | null)?.id
  if (closedSessionId) await creditVisitsForSession(closedSessionId)

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

export interface QRStyleOptions {
  foregroundColor?: string
  backgroundColor?: string
  shape?: 'square' | 'rounded'
  logoEnabled?: boolean
  logoSize?: number
}

export async function generateTableQR(
  tableId: string,
  restaurantId: string,
  restaurantSlug: string,
  style: QRStyleOptions = {},
  logoUrl?: string | null,
): Promise<{ error: string } | { qrDataUrl: string }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data: table } = await supabase
    .from('tables')
    .select('id')
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!table) return { error: 'Table not found for this restaurant' }

  const { generateQRDataURL } = await import('@garsonless/qr')
  const url = `${process.env['NEXT_PUBLIC_MENU_URL'] ?? 'http://localhost:3001'}/${restaurantSlug}/table/${tableId}`

  const qrDataUrl = await generateQRDataURL({
    url,
    size: 512,
    foregroundColor: style.foregroundColor ?? '#000000',
    backgroundColor: style.backgroundColor ?? '#ffffff',
    shape: style.shape ?? 'square',
    logoPath: style.logoEnabled && logoUrl ? logoUrl : undefined,
    logoSize: style.logoSize ?? 20,
  })

  return { qrDataUrl }
}

export async function saveQRStyle(
  restaurantId: string,
  style: QRStyleOptions,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthUser()
  if (!user) return { error: 'Not authenticated' }

  const isOwner = await assertRestaurantOwner(supabase, restaurantId, user.id)
  if (!isOwner) return { error: 'Not authorized' }

  const { data: existing } = await supabase
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .single()

  const mergedSettings = {
    ...((existing as { settings: Record<string, unknown> } | null)?.settings ?? {}),
    qr_style: style,
  }

  const { error } = await mut(supabase, 'restaurants')
    .update({ settings: mergedSettings })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}
