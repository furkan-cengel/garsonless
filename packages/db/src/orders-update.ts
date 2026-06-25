import { createServiceClient } from './client'
import { earnForOrder, refundCancelledLoyaltyOrder, creditVisitsForSession, shouldEarnOnSettlement } from './loyalty'
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
// the FIRST settlement wins — a retry/re-callback never overwrites the method),
// returning the order's session id to drive the auto-close.
type SettleUpdateBuilder = {
  update: (row: Record<string, unknown>) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        is: (col: string, val: null) => {
          select: (cols: string) => Promise<{
            data: Array<{ id: string; table_session_id: string | null }> | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

type SessionLookupBuilder = {
  select: (cols: string) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { table_session_id: string | null } | null }>
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
 * re-callback can never overwrite the recorded method). After settling, the
 * session auto-closes iff every non-cancelled order in it is now paid.
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
    .select('id, table_session_id')
  if (error) return { error: error.message }

  // 0 rows: the order is either already settled (retry/re-callback) OR not in
  // this restaurant. Resolve the session id scoped so the auto-close still runs;
  // a genuinely missing/foreign order rejects.
  let tableSessionId: string | null
  let freshlySettled = false
  if (data && data.length > 0) {
    freshlySettled = true
    tableSessionId = data[0]?.table_session_id ?? null
  } else {
    const lookup = supabase.from('orders') as unknown as SessionLookupBuilder
    const { data: existing } = await lookup
      .select('table_session_id')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    if (!existing) return { error: 'Order not found for this restaurant' }
    tableSessionId = existing.table_session_id ?? null
  }

  // Loyalty earning on the 'paid' trigger (best-effort; never throws). Only on a
  // FRESH settlement, and NEVER for comp — İkram must not farm loyalty points.
  if (shouldEarnOnSettlement(method, freshlySettled)) {
    await earnForOrder(orderId, 'paid')
  }

  // Auto-close: if every non-cancelled order in the session is now paid, close
  // it (race-safe RPC: exactly one concurrent caller wins) and credit visits —
  // the same side effect as a manual close. Best-effort: a close failure must
  // never fail the payment write.
  if (tableSessionId) {
    try {
      const { data: closed } = await supabase.rpc('close_session_if_fully_paid', {
        p_session_id: tableSessionId,
      })
      if (closed === true) {
        await creditVisitsForSession(tableSessionId)
      }
    } catch (err) {
      console.error(`[markOrderPaidDB] auto-close order=${orderId}:`, err)
    }
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
