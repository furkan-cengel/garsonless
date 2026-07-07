import { createServiceClient } from './client'
import { earnForOrder, refundCancelledLoyaltyOrder, shouldEarnOnSettlement } from './loyalty'
import { ORDER_STATUS_TRANSITIONS } from './enums'
import type { OrderStatus, PaymentMethod } from './enums'

// @supabase/supabase-js v2 resolves .update()/.select() as never[] when consumed
// cross-package under strict TypeScript. Inline casts isolate the workaround here.
type ScopedUpdateBuilder = {
  update: (row: Record<string, unknown>) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        in: (col: string, vals: string[]) => {
          select: (cols: string) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>
        }
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
          neq: (col: string, val: string) => {
            select: (cols: string) => Promise<{
              data: Array<{ id: string }> | null
              error: { message: string } | null
            }>
          }
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
  // Cancellation is NOT a plain status hop anymore: it has payment rules
  // (İyzico block), audit fields (cancel_reason/cancelled_by) and the loyalty
  // refund — exactly ONE path owns it: cancelOrderDB. Rejecting here means no
  // caller can sidestep the rules via the generic status writer.
  if (status === 'cancelled') {
    return { error: 'Use cancelOrderDB for cancellations' }
  }
  // Transition matrix (ORDER_STATUS_TRANSITIONS — shared with the board's drag
  // guard), enforced ATOMICALLY: the UPDATE only matches when the CURRENT
  // status is a legal source for the target. Self-transitions are in the map
  // (idempotent no-op for double-clicks/retries); terminal states
  // (served/cancelled) have no exits. A bypassed client cannot skip stages.
  const allowedFrom = ORDER_STATUS_TRANSITIONS[status] ?? []
  if (allowedFrom.length === 0) return { error: `Illegal status transition to '${status}'` }
  const supabase = createServiceClient()
  const builder = supabase.from('orders') as unknown as ScopedUpdateBuilder
  const { data, error } = await builder
    .update({ status })
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .in('status', allowedFrom)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    // 0 rows — diagnose read-only: missing/foreign vs illegal transition.
    const lookup = supabase.from('orders') as unknown as OrderScopeLookupBuilder
    const { data: existing } = await lookup
      .select('id, status')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    const found = existing as unknown as { id: string; status: string } | null
    if (!found) return { error: 'Order not found for this restaurant' }
    return { error: `Illegal status transition: ${found.status} → ${status}` }
  }

  // Loyalty earning on the 'served' trigger (best-effort; never throws). The
  // config's earn_trigger gate inside earnForOrder ensures only the configured
  // trigger actually credits.
  if (status === 'served') {
    await earnForOrder(orderId, 'served')
  }
  return { error: null }
}

// PostgREST builder shape for the cancel path (same never[] workaround).
type CancelUpdateBuilder = {
  update: (row: Record<string, unknown>) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        neq: (col: string, val: string) => {
          or: (filters: string) => {
            select: (cols: string) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>
          }
        }
      }
    }
  }
}

/**
 * THE single cancel path — dashboard action AND kitchen action both land here.
 *
 * Payment rules (enforced ATOMICALLY in the WHERE clause, not read-then-write,
 * so a concurrent İyzico callback can never be bypassed):
 *  - İYZICO-paid / split-paid → BLOCKED. Online/split money needs a manual
 *    refund or share-ledger adjustment path (deferred); the app must not orphan it.
 *  - cash/pos-paid → allowed; the CALLER (dashboard action) enforces the
 *    required reason before invoking. Staff refunds in person.
 *  - unpaid → plain cancel, behavior identical to the old path.
 *
 * Audit: cancel_reason + cancelled_by are stamped when provided (kitchen has
 * no staff identity → both null). Already-cancelled → idempotent no-op.
 * Loyalty refund (idempotent, Sprint 19a) fires exactly as before.
 */
export async function cancelOrderDB(
  orderId: string,
  restaurantId: string,
  opts?: { reason?: string | null; cancelledBy?: string | null },
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()

  const builder = supabase.from('orders') as unknown as CancelUpdateBuilder
  const { data, error } = await builder
    .update({
      status: 'cancelled',
      cancel_reason: opts?.reason?.trim() ? opts.reason.trim().slice(0, 200) : null,
      cancelled_by: opts?.cancelledBy ?? null,
    })
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .neq('status', 'cancelled')
    // NOT (paid_at IS NOT NULL AND payment_method IN ('iyzico','split')).
    // PostgREST OR/AND form: unpaid OR legacy-null OR paid by a non-online,
    // non-split method. This is the atomic mirror of the dashboard pre-read.
    .or('paid_at.is.null,payment_method.is.null,and(payment_method.neq.iyzico,payment_method.neq.split)')
    .select('id')

  if (error) return { error: error.message }

  if (!data || data.length === 0) {
    // 0 rows — diagnose which guard held (read-only; the write already refused).
    const { data: row } = await supabase
      .from('orders')
      .select('status, paid_at, payment_method')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    const existing = row as { status: string; paid_at: string | null; payment_method: string | null } | null
    if (!existing) return { error: 'Order not found for this restaurant' }
    if (existing.status === 'cancelled') return { error: null } // idempotent no-op
    if (existing.paid_at !== null && existing.payment_method === 'iyzico') {
      return { error: 'Bu sipariş online ödendi — iadeyi İyzico panelinden manuel yapın.' }
    }
    if (existing.paid_at !== null && existing.payment_method === 'split') {
      return { error: 'Bu sipariş hesap bölüşme ile ödendi — pay iadeleri/iptali ayrı iade akışı gerektirir.' }
    }
    return { error: 'Sipariş iptal edilemedi' }
  }

  // Idempotent loyalty refund — unchanged from the old cancel path.
  await refundCancelledLoyaltyOrder(orderId)
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
    // Cancellation is terminal — money must never be stamped onto a cancelled
    // order (it would vanish from ciro: collected excludes cancelled). This is
    // the ATOMIC mirror of cancelOrderDB's İyzico block: whichever of
    // settle∥cancel lands first wins, the loser gets a typed error — the race
    // can never produce a cancelled+paid row.
    .neq('status', 'cancelled')
    .select('id')
  if (error) return { error: error.message }

  // 0 rows: already settled (retry/re-callback → no-op), CANCELLED (refuse),
  // or not in this restaurant (reject). Diagnose read-only — the write above
  // already refused.
  let freshlySettled = false
  if (data && data.length > 0) {
    freshlySettled = true
  } else {
    const lookup = supabase.from('orders') as unknown as OrderScopeLookupBuilder
    const { data: existing } = await lookup
      .select('id, status, paid_at')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    const found = existing as unknown as { id: string; status: string; paid_at: string | null } | null
    if (!found) return { error: 'Order not found for this restaurant' }
    if (found.paid_at === null && found.status === 'cancelled') {
      return { error: 'Order is cancelled — settlement refused' }
    }
    // paid_at already set → settled earlier (retry/re-callback) → no-op success.
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
