'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import { updateOrderStatusDB } from '@garsonless/db'
import type { OrderStatus } from '@garsonless/db'
import { mut } from '../supabase-mut'

const schema = z.object({
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
})

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const parsed = schema.safeParse({ orderId, status, restaurantId })
  if (!parsed.success) return { error: 'Invalid input' }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership: order must belong to a restaurant owned by this user
  const { data: order } = await supabase
    .from('orders')
    .select('restaurant_id')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Order not found' }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', (order as { restaurant_id: string }).restaurant_id)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return { error: 'Not authorized' }

  const { error } = await updateOrderStatusDB(orderId, status, restaurantId)
  if (error) return { error }

  revalidatePath(`/dashboard/${restaurantId}/orders`)
  return { success: true }
}

const createOrderSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid().nullable(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number().int().positive(),
    price: z.number().nonnegative(),
  })),
  total: z.number().nonnegative(),
})

export async function createOrderFromDashboard(
  input: z.infer<typeof createOrderSchema>,
): Promise<{ error: string } | { orderId: string }> {
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', parsed.data.restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return { error: 'Not authorized' }

  if (parsed.data.tableId) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('id', parsed.data.tableId)
      .eq('restaurant_id', parsed.data.restaurantId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!table) return { error: 'Table not found for this restaurant' }
  }

  const { data, error } = await mut(supabase, 'orders')
    .insert({
      restaurant_id: parsed.data.restaurantId,
      table_id: parsed.data.tableId,
      items: parsed.data.items,
      total: parsed.data.total,
      status: 'sent_to_kitchen' as OrderStatus,
      session_id: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const orderId = (data as { id: string } | null)?.id
  if (!orderId) return { error: 'Failed to create order' }

  revalidatePath(`/dashboard/${parsed.data.restaurantId}/orders`)
  return { orderId }
}
