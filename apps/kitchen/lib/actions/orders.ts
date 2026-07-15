'use server'

import { z } from 'zod'
import {
  type Tables,
} from '@garsonless/db'
import { transitionKitchenOrder } from '@garsonless/application/orders'
import { listKitchenOrders, readKitchenOrder } from '@garsonless/application/tables'
import {
  createKitchenBoardPort,
  createKitchenOrderPort,
  verifyKitchenActor,
} from '@garsonless/db/server'
import type { OrderStatus } from '@garsonless/domain/orders'

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

  const valid = await verifyKitchenActor(restaurantId, kitchenToken)
  if (!valid) return { error: 'Invalid kitchen token' }
  const result = await transitionKitchenOrder(
    { actor: 'kitchen', restaurantId, stationId: stationScope },
    { orderId, restaurantId, status: parsed.data.status },
    createKitchenOrderPort(),
  )
  if (!result.ok) return { error: result.error }
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

  const valid = await verifyKitchenActor(restaurantId, kitchenToken)
  if (!valid) return { error: 'Invalid kitchen token' }
  try {
    const result = await readKitchenOrder(
      { actor: 'kitchen', restaurantId, stationId: 'expo' },
      { orderId, restaurantId },
      createKitchenBoardPort(),
    )
    if (!result.ok) return { error: result.error }
    if (!result.value) return { error: 'Order not found' }
    return { order: result.value as Tables<'orders'> }
  } catch {
    return { error: 'Orders unavailable' }
  }
}

export async function getKitchenOrdersAction(
  restaurantId: string,
  kitchenToken: string,
): Promise<{ error: string } | { orders: Tables<'orders'>[] }> {
  const parsed = z.object({ restaurantId: z.string().uuid(), kitchenToken: z.string().min(1) })
    .safeParse({ restaurantId, kitchenToken })
  if (!parsed.success) return { error: 'Invalid input' }
  if (!await verifyKitchenActor(restaurantId, kitchenToken)) return { error: 'Invalid kitchen token' }
  try {
    const result = await listKitchenOrders(
      { actor: 'kitchen', restaurantId, stationId: 'expo' },
      restaurantId,
      createKitchenBoardPort(),
    )
    return result.ok
      ? { orders: result.value as Tables<'orders'>[] }
      : { error: result.error }
  } catch {
    return { error: 'Orders unavailable' }
  }
}
