'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import {
  cancelDashboardOrder,
  createDashboardOrder,
  transitionDashboardOrder,
} from '@garsonless/application/orders'
import { startOfDayNDaysAgo } from '@garsonless/db/browser'
import {
  createDashboardOrderPort,
  createDashboardOrderLifecyclePort,
} from '@garsonless/db/server'
import type { OrderStatus, Json } from '@garsonless/db'
import { assertAccess } from '../auth/access'
import { getRestaurantTimezone } from '../queries'

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

  // The adapter resolves the user; application re-checks tenant + permission
  // before the package-private atomic repository primitive can be reached.
  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return { error: gate.error }

  const result = await transitionDashboardOrder(
    {
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId,
      permissions: ['orders'],
    },
    { orderId, status, restaurantId },
    createDashboardOrderLifecyclePort(),
  )
  if (!result.ok) return { error: result.error }

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
 *    the provider/share ledger path). Also enforced atomically by the DB port.
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

  const result = await cancelDashboardOrder(
    {
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId,
      permissions: ['orders'],
    },
    { orderId, restaurantId, reason: parsed.data.reason },
    createDashboardOrderLifecyclePort(),
  )
  if (!result.ok) return { error: result.error }

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
): Promise<{ error: string } | { orders: HistoryOrder[]; truncated: boolean }> {
  const gate = await assertAccess(restaurantId, 'orders')
  if ('error' in gate) return { error: gate.error }

  const supabase = await createDashboardServerClient()
  const since = startOfDayNDaysAgo(await getRestaurantTimezone(restaurantId), 30)

  const { data, error } = await supabase
    .from('orders')
    .select('id, table_id, status, items, total, created_at, paid_at, payment_method, customer_tier')
    .eq('restaurant_id', restaurantId)
    .in('status', ['served', 'cancelled'])
    .gte('created_at', since.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(201)

  if (error) return { error: error.message }
  const rows = (data ?? []) as HistoryOrder[]
  return { orders: rows.slice(0, 200), truncated: rows.length > 200 }
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

  const result = await createDashboardOrder(
    {
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId: parsed.data.restaurantId,
      permissions: ['orders'],
    },
    {
      restaurantId: parsed.data.restaurantId,
      tableId: parsed.data.tableId,
      lines: parsed.data.items,
    },
    createDashboardOrderPort(),
  )
  if (!result.ok) return { error: result.error }
  const { orderId } = result.value

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}`)
  revalidatePath(`/dashboard/${parsed.data.restaurantId}/tables`)
  return { orderId }
}
