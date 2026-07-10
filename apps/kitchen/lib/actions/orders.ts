'use server'

import { z } from 'zod'
import {
  createServiceClient,
  validateKitchenToken,
  updateOrderStatusDB,
  type OrderStatus,
  type Tables,
} from '@garsonless/db'
import { readOrderLineSnapshots } from '@garsonless/db/order-client'

const updateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['preparing', 'ready']),
  restaurantId: z.string().uuid(),
  kitchenToken: z.string().min(1),
  stationScope: z.union([z.literal('expo'), z.literal('unassigned'), z.string().uuid()]),
})

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  restaurantId: string,
  kitchenToken: string,
  stationScope: 'expo' | 'unassigned' | string,
): Promise<{ error: string } | { success: true }> {
  const parsed = updateSchema.safeParse({ orderId, status, restaurantId, kitchenToken, stationScope })
  if (!parsed.success) return { error: 'Invalid input' }

  const valid = await validateKitchenToken(restaurantId, kitchenToken)
  if (!valid) return { error: 'Invalid kitchen token' }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('orders')
    .select('id, status, items')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (!data) return { error: 'Order not found' }

  const currentStatus = data.status as OrderStatus
  const canStart = status === 'preparing'
    && ['pending', 'pending_approval', 'sent_to_kitchen', 'paid'].includes(currentStatus)
  const canFinish = status === 'ready' && currentStatus === 'preparing'
  if (!canStart && !canFinish) return { error: 'Invalid kitchen status transition' }

  const lines = readOrderLineSnapshots(data.items)
  const stationKeys = new Set(lines.map((line) => line.station?.id ?? 'unassigned'))
  if (stationScope !== 'expo') {
    if (!stationKeys.has(stationScope)) return { error: 'Order does not belong to this station' }
    if (status === 'ready' && (stationKeys.size !== 1 || !stationKeys.has(stationScope))) {
      return { error: 'Çok istasyonlu siparişi Son Kontrol tamamlar' }
    }
  }

  // Kitchen tokens can prepare food and mark it ready. Serving is a staff
  // hand-off and remains available only through the authenticated dashboard.
  const { error } = await updateOrderStatusDB(orderId, status, restaurantId)
  if (error) return { error }
  return { success: true }
}

const fetchSchema = z.object({
  orderId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  kitchenToken: z.string().min(1),
})

export async function getKitchenOrderAction(
  orderId: string,
  restaurantId: string,
  kitchenToken: string,
): Promise<{ error: string } | { order: Tables<'orders'> }> {
  const parsed = fetchSchema.safeParse({ orderId, restaurantId, kitchenToken })
  if (!parsed.success) return { error: 'Invalid input' }

  const valid = await validateKitchenToken(restaurantId, kitchenToken)
  if (!valid) return { error: 'Invalid kitchen token' }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!data) return { error: 'Order not found' }
  return { order: data as Tables<'orders'> }
}
