// Hand-maintained domain enums. types.gen.ts is overwritten by `pnpm types:gen`
// (DB columns are plain text with check constraints), so these unions live here.
// Source of truth: 20260517000000_initial_schema.sql check constraints
// + 'paid' used by the İyzico payment callback (Sprint 6).

export type OrderStatus =
  | 'pending'
  | 'pending_approval'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled'

/**
 * Legal status transitions — THE single source for both the dashboard board
 * (drag/advance) and updateOrderStatusDB's atomic server guard.
 * Keyed by TARGET status → the statuses it may be entered FROM.
 *
 * Covers every real caller's hops:
 *  - dashboard: pending|pending_approval→sent_to_kitchen, prep-group→ready,
 *    ready→served, and ready→sent_to_kitchen as a one-step mis-tap correction.
 *  - kitchen app: pending|pending_approval|sent_to_kitchen|paid→preparing,
 *    preparing→ready, ready→served.
 *  - self-transitions allowed (idempotent no-op for double-clicks/retries).
 * NOT here: 'cancelled' (owned exclusively by cancelOrderDB) and 'paid'
 * (legacy status — payment is a column; nothing transitions TO it anymore).
 * 'served' and 'cancelled' are terminal: no way out.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: [],
  pending_approval: [],
  sent_to_kitchen: ['pending', 'pending_approval', 'ready', 'sent_to_kitchen'],
  preparing: ['pending', 'pending_approval', 'sent_to_kitchen', 'paid', 'preparing'],
  ready: ['sent_to_kitchen', 'preparing', 'paid', 'ready'],
  served: ['ready', 'served'],
  paid: [],
  cancelled: [],
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_STATUS_TRANSITIONS[to] ?? []).includes(from)
}

export type RestaurantPlan = 'free' | 'starter' | 'pro' | 'enterprise'

// How an order was settled (orders.payment_method). null = unpaid OR legacy-paid.
// 'comp' (İkram) is settled but ₺0 COLLECTED — excluded from ciro, reportable
// separately. Source of truth: 20260625000000_payment_method_settle.sql.
export type PaymentMethod = 'iyzico' | 'cash' | 'pos' | 'comp'
