import { createServiceClient } from './client'
import { earnForOrder, refundCancelledLoyaltyOrder, shouldEarnOnSettlement } from './loyalty'
import type { OrderStatus, PaymentMethod } from './enums'

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

// markOrderPaidDB settle path: scoped update guarded by `paid_at IS NULL` (only
// the FIRST settlement wins — a retry/re-callback never overwrites the method).
// Payment stamps the bill ONLY; it does NOT close the table (a paid table is
// freed solely by an explicit staff close — see dashboard closeTableSession).
type SettleUpdateBuilder = {
  update: (row: Record<string, unknown>) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        is: (col: string, val: null) => {
          select: (cols: string) => Promise<{
            data: Array<{ id: string }> | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

// Existence/scope check for the 0-rows settle branch (already-paid retry vs a
// genuinely missing/foreign order).
type OrderScopeLookupBuilder = {
  select: (cols: string) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { id: string } | null }>
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

/**
 * Settle an order: payment is a column, not a kitchen stage — never touches
 * status. Scoped to the expected restaurant (GAP #3 defense-in-depth) and
 * guarded by `paid_at IS NULL` so only the first settlement wins (a retry or
 * re-callback can never overwrite the recorded method).
 *
 * Payment SETTLES THE BILL ONLY — it does NOT free the table. A fully-paid
 * session stays open (closed_at null) and renders as "Ödendi"; the table is
 * freed solely by an explicit staff close (dashboard closeTableSession), which
 * credits the visit. Decoupled 2026-06-27: app/İyzico payment must never empty a
 * table the customer is still sitting at (they can keep ordering on the same
 * session). The pg_cron safety-net sweep is the backstop for forgotten paid
 * tables; visit crediting therefore happens at free-time, not pay-time.
 *
 * @param method how the money came in. 'comp' (İkram) is settled at ₺0 collected
 *   and NEVER earns loyalty (a freebie must not mint points).
 * @param settledBy staff user id for a manual cash/pos/comp settlement (audit);
 *   null/undefined for İyzico (system).
 */
export async function markOrderPaidDB(
  orderId: string,
  restaurantId: string,
  method: PaymentMethod,
  settledBy?: string | null,
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()
  const builder = supabase.from('orders') as unknown as SettleUpdateBuilder
  const { data, error } = await builder
    .update({
      paid_at: new Date().toISOString(),
      payment_method: method,
      settled_by: settledBy ?? null,
    })
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .is('paid_at', null)
    .select('id')
  if (error) return { error: error.message }

  // 0 rows: the order is either already settled (retry/re-callback) OR not in
  // this restaurant. Confirm it exists here so a genuinely missing/foreign order
  // still rejects (the `paid_at IS NULL` no-op for a retry returns 0 rows too).
  let freshlySettled = false
  if (data && data.length > 0) {
    freshlySettled = true
  } else {
    const lookup = supabase.from('orders') as unknown as OrderScopeLookupBuilder
    const { data: existing } = await lookup
      .select('id')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    if (!existing) return { error: 'Order not found for this restaurant' }
  }

  // Loyalty earning on the 'paid' trigger (best-effort; never throws). Only on a
  // FRESH settlement, and NEVER for comp — İkram must not farm loyalty points.
  if (shouldEarnOnSettlement(method, freshlySettled)) {
    await earnForOrder(orderId, 'paid')
  }

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
