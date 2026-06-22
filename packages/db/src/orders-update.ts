import { createServiceClient } from './client'
import { earnForOrder, refundCancelledLoyaltyOrder } from './loyalty'
import type { OrderStatus } from './enums'

// @supabase/supabase-js v2 resolves .update()/.select() as never[] when consumed
// cross-package under strict TypeScript. Inline casts isolate the workaround here.
type ScopedUpdateBuilder = {
  update: (row: Record<string, unknown>) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        select: (cols: string) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>
      }
    }
  }
}

type KitchenTokenBuilder = {
  select: (cols: string) => {
    eq: (col: string, val: string) => {
      maybeSingle: () => Promise<{ data: { token: string } | null }>
    }
  }
}

// Restaurant-scoped status write (GAP #3): the UPDATE is constrained to the
// EXPECTED restaurant, so a caller holding restaurant A's authority (kitchen
// token / owner session) can never mutate restaurant B's order by id. 0 rows
// affected → the order doesn't belong to that restaurant → reject.
export async function updateOrderStatusDB(
  orderId: string,
  status: OrderStatus,
  restaurantId: string,
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()
  const builder = supabase.from('orders') as unknown as ScopedUpdateBuilder
  const { data, error } = await builder
    .update({ status })
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Order not found for this restaurant' }

  // Loyalty earning on the 'served' trigger (best-effort; never throws). The
  // config's earn_trigger gate inside earnForOrder ensures only the configured
  // trigger actually credits.
  if (status === 'served') {
    await earnForOrder(orderId, 'served')
  }
  if (status === 'cancelled') {
    await refundCancelledLoyaltyOrder(orderId)
  }
  return { error: null }
}

/** Payment is a column, not a kitchen stage — never touches status. Scoped to
 *  the expected restaurant (GAP #3 defense-in-depth). */
export async function markOrderPaidDB(
  orderId: string,
  restaurantId: string,
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()
  const builder = supabase.from('orders') as unknown as ScopedUpdateBuilder
  const { data, error } = await builder
    .update({ paid_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Order not found for this restaurant' }

  // Loyalty earning on the 'paid' trigger (best-effort; never throws).
  await earnForOrder(orderId, 'paid')
  return { error: null }
}

// Kitchen token now lives in the service-role-only kitchen_credentials table
// (GAP #1) — never in the anon-readable restaurants.settings blob.
export async function validateKitchenToken(
  restaurantId: string,
  token: string,
): Promise<boolean> {
  if (!token) return false
  const supabase = createServiceClient()
  const builder = supabase.from('kitchen_credentials') as unknown as KitchenTokenBuilder
  const { data } = await builder.select('token').eq('restaurant_id', restaurantId).maybeSingle()
  if (!data) return false
  return data.token === token
}
