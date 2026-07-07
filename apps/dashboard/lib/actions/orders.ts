'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { createServiceClient, resolveOrderLines, updateOrderStatusDB, cancelOrderDB } from '@garsonless/db'
import type { OrderStatus, Json } from '@garsonless/db'
import { mut } from '../supabase-mut'
import { assertAccess } from '../auth/access'

// 'cancelled' is deliberately NOT in this enum — cancellation has payment rules
// (İyzico block, required reason for cash/pos-paid) and audit stamping, owned
// by the dedicated cancelOrder action below.
const schema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    'pending',
    'pending_approval',
    'sent_to_kitchen',
    'preparing',
    'ready',
    'served',
  ]),
  restaurantId: z.string().uuid(),
})

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const parsed = schema.safeParse({ orderId, status, restaurantId })
  if (!parsed.success) return { error: 'Invalid input' }

  // Owner OR a member with 'orders'. updateOrderStatusDB scopes by restaurant_id,
  // so a mismatched order returns not-found.
  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return { error: gate.error }

  const { error } = await updateOrderStatusDB(orderId, status, restaurantId)
  if (error) return { error }

  revalidatePath(`/dashboard/${restaurantId}/orders`)
  return { success: true }
}

const cancelSchema = z.object({
  orderId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  reason: z.string().trim().max(200).optional(),
})

/**
 * THE dashboard cancel path. Rules by payment state:
 *  - İyzico-paid or split-paid → BLOCKED (typed error; refund/adjustment needs
 *    the provider/share ledger path). Also enforced atomically inside
 *    cancelOrderDB's WHERE — this pre-read is for a friendly early error, the
 *    DB guard is the real wall.
 *  - cash/pos-paid → reason REQUIRED (min 3 chars): money was collected and is
 *    being refunded in person — the decision must be recorded.
 *  - unpaid → plain cancel (reason optional), loyalty refund identical to before.
 * cancelled_by = the acting staff user (audit), like settled_by on settlements.
 */
export async function cancelOrder(
  orderId: string,
  restaurantId: string,
  reason?: string,
): Promise<{ error: string } | { success: true }> {
  const parsed = cancelSchema.safeParse({ orderId, restaurantId, reason })
  if (!parsed.success) return { error: 'Geçersiz iptal isteği' }

  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return { error: gate.error }

  const supabase = createServiceClient()
  const { data: row } = await supabase
    .from('orders')
    .select('paid_at, payment_method, status')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  const order = row as { paid_at: string | null; payment_method: string | null; status: string } | null
  if (!order) return { error: 'Order not found for this restaurant' }
  if (order.status === 'cancelled') return { success: true } // idempotent no-op

  const paid = order.paid_at !== null
  if (paid && order.payment_method === 'iyzico') {
    return { error: 'Bu sipariş online ödendi — iadeyi İyzico panelinden manuel yapın.' }
  }
  if (paid && order.payment_method === 'split') {
    return { error: 'Bu sipariş hesap bölüşme ile ödendi — pay iadeleri/iptali ayrı iade akışı gerektirir.' }
  }
  const trimmedReason = parsed.data.reason?.trim() ?? ''
  if (paid && (order.payment_method === 'cash' || order.payment_method === 'pos') && trimmedReason.length < 3) {
    return { error: 'Ödenmiş siparişin iptali için gerekçe zorunlu (en az 3 karakter).' }
  }

  const { error } = await cancelOrderDB(orderId, restaurantId, {
    reason: trimmedReason || null,
    cancelledBy: gate.userId,
  })
  if (error) return { error }

  revalidatePath(`/dashboard/${restaurantId}/orders`)
  return { success: true }
}

export interface HistoryOrder {
  id: string
  table_id: string | null
  status: string
  items: Json
  total: number
  created_at: string
  paid_at: string | null
  payment_method: string | null
  customer_tier: Json | null
}

/**
 * Past served/cancelled orders (last 30 days) for the "Geçmiş siparişler" modal.
 * Owner OR a member with 'orders'; read through the RLS-scoped auth client.
 */
export async function getOrderHistory(
  restaurantId: string,
): Promise<{ error: string } | { orders: HistoryOrder[] }> {
  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return { error: gate.error }

  const supabase = await createDashboardServerClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  since.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('orders')
    .select('id, table_id, status, items, total, created_at, paid_at, payment_method, customer_tier')
    .eq('restaurant_id', restaurantId)
    .in('status', ['served', 'cancelled'])
    .gte('created_at', since.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { error: error.message }
  return { orders: (data ?? []) as HistoryOrder[] }
}

const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid().nullable(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
    selectedModifiers: z.array(z.object({
      group_id: z.string(),
      option_id: z.string(),
      quantity: z.number().int().positive().optional(),
    })).optional(),
    removedIngredientIds: z.array(z.string()).optional(),
  })),
})

export async function createOrderFromDashboard(
  input: z.infer<typeof createOrderSchema>,
): Promise<{ error: string } | { orderId: string }> {
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const gate = await assertAccess(parsed.data.restaurantId, 'orders')
  if ('error' in gate) return { error: gate.error }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const resolved = await resolveOrderLines(parsed.data.restaurantId, parsed.data.items)
  if (!resolved.ok) return { error: resolved.error }

  let tableSessionId: string | null = null
  if (parsed.data.tableId) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('id', parsed.data.tableId)
      .eq('restaurant_id', parsed.data.restaurantId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!table) return { error: 'Table not found for this restaurant' }

    // The RPC is service-role only. Access and table ownership have already
    // been validated above; using the shared primitive preserves its
    // concurrent-open guard and attaches dashboard orders to the real adisyon.
    const { data: sessionId, error: sessionError } = await createServiceClient()
      .rpc('open_or_get_table_session', {
        p_restaurant_id: parsed.data.restaurantId,
        p_table_id: parsed.data.tableId,
      })
    if (sessionError || !sessionId) return { error: 'Failed to open table session' }
    tableSessionId = sessionId
  }

  const { data, error } = await mut(supabase, 'orders')
    .insert({
      restaurant_id: parsed.data.restaurantId,
      table_id: parsed.data.tableId,
      table_session_id: tableSessionId,
      items: resolved.snapshots as unknown as import('@garsonless/db').Json,
      total: resolved.snapshots.reduce(
        (sum, line) => sum + (line.price + line.modifiersPriceDelta) * line.quantity,
        0,
      ),
      status: 'sent_to_kitchen' as OrderStatus,
      session_id: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const orderId = (data as { id: string } | null)?.id
  if (!orderId) return { error: 'Failed to create order' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { orderId }
}
