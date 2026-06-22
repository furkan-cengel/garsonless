'use server'

import { z } from 'zod'
import {
  createServiceClient,
  validateKitchenToken,
  updateOrderStatusDB,
  type OrderStatus,
  type Tables,
} from '@garsonless/db'

const updateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    'pending',
    'pending_approval',
    'sent_to_kitchen',
    'preparing',
    'ready',
    'served',
    'cancelled',
  ]),
  restaurantId: z.string().uuid(),
  kitchenToken: z.string().min(1),
})

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  restaurantId: string,
  kitchenToken: string,
): Promise<{ error: string } | { success: true }> {
  const parsed = updateSchema.safeParse({ orderId, status, restaurantId, kitchenToken })
  if (!parsed.success) return { error: 'Invalid input' }

  const valid = await validateKitchenToken(restaurantId, kitchenToken)
  if (!valid) return { error: 'Invalid kitchen token' }

  // GAP #3: scope the write to the token's restaurant — a valid token for A
  // cannot advance B's order even if the orderId is known.
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
