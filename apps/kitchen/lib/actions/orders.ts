'use server'

import { z } from 'zod'
import { transitionKitchenOrder } from '@garsonless/application/orders'
import {
  readKitchenOrders,
  type KitchenOrderProjectionBatch,
} from '@garsonless/application/tables'
import {
  createKitchenBoardPort,
  createKitchenOrderPort,
} from '@garsonless/db/server'
import type { OrderStatus } from '@garsonless/domain/orders'
import { hasValidKitchenSession } from '../kitchen-session'

const updateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['preparing', 'ready']),
  restaurantId: z.string().uuid(),
  stationScope: z.union([z.literal('expo'), z.literal('unassigned'), z.string().uuid()]),
})

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  restaurantId: string,
  stationScope: 'expo' | 'unassigned' | string,
): Promise<{ error: string } | { success: true }> {
  const parsed = updateSchema.safeParse({ orderId, status, restaurantId, stationScope })
  if (!parsed.success) return { error: 'Invalid input' }

  if (!await hasValidKitchenSession(restaurantId)) return { error: 'Kitchen session expired' }
  const result = await transitionKitchenOrder(
    { actor: 'kitchen', restaurantId, stationId: stationScope },
    { orderId, restaurantId, status: parsed.data.status },
    createKitchenOrderPort(),
  )
  if (!result.ok) return { error: result.error }
  return { success: true }
}

const fetchSchema = z.object({
  restaurantId: z.string().uuid(),
  after: z.string().datetime({ offset: true }).nullable(),
})

export async function getKitchenOrdersAction(
  restaurantId: string,
  after: string | null,
): Promise<{ error: string } | { batch: KitchenOrderProjectionBatch }> {
  const parsed = fetchSchema.safeParse({ restaurantId, after })
  if (!parsed.success) return { error: 'Invalid input' }

  if (!await hasValidKitchenSession(restaurantId)) return { error: 'Kitchen session expired' }
  try {
    const result = await readKitchenOrders(
      { actor: 'kitchen', restaurantId, stationId: 'expo' },
      { restaurantId, after: parsed.data.after },
      createKitchenBoardPort(),
    )
    if (!result.ok) return { error: result.error }
    return { batch: result.value }
  } catch {
    return { error: 'Orders unavailable' }
  }
}
