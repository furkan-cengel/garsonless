export type OrderStatus =
  | 'pending'
  | 'pending_approval'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled'

export type PaymentMethod = 'iyzico' | 'cash' | 'pos' | 'comp' | 'split'

/** Orders that still participate in the live operational queue. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'pending_approval',
  'sent_to_kitchen',
  'preparing',
  'ready',
  'served',
]

/**
 * Canonical collected-revenue specification. Database adapters translate this
 * data-only policy to PostgREST/SQL while browser code evaluates it directly.
 * A paid legacy row with a null method is collected; a comp is not revenue.
 */
export const COLLECTED_ORDER_SPEC = {
  paidAtRequired: true,
  excludedStatuses: ['cancelled'],
  excludedPaymentMethods: ['comp'],
  includeNullPaymentMethod: true,
} as const

/** Target status -> allowed source statuses. Cancellation and payment each have
 * dedicated commands, so neither is a generic status transition. */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
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
  return ORDER_STATUS_TRANSITIONS[to].includes(from)
}

export type OrderCancellationDecision =
  | { allowed: true; reason: string | null; alreadyCancelled: boolean }
  | { allowed: false; error: string }

/**
 * Pure preflight policy for staff cancellation. The database adapter mirrors
 * the online/split guards atomically so a concurrent provider settlement can
 * never race this read into an invalid cancelled+paid row.
 */
export function evaluateOrderCancellation(input: {
  status: string
  paidAt: string | null
  paymentMethod: string | null
  reason?: string | null
}): OrderCancellationDecision {
  const reason = input.reason?.trim().slice(0, 200) || null
  if (input.status === 'cancelled') {
    return { allowed: true, reason, alreadyCancelled: true }
  }
  if (input.paidAt !== null && input.paymentMethod === 'iyzico') {
    return { allowed: false, error: 'Bu sipariş online ödendi — iadeyi İyzico panelinden manuel yapın.' }
  }
  if (input.paidAt !== null && input.paymentMethod === 'split') {
    return { allowed: false, error: 'Bu sipariş hesap bölüşme ile ödendi — pay iadeleri/iptali ayrı iade akışı gerektirir.' }
  }
  if (
    input.paidAt !== null
    && (input.paymentMethod === 'cash' || input.paymentMethod === 'pos')
    && (reason?.length ?? 0) < 3
  ) {
    return { allowed: false, error: 'Ödenmiş siparişin iptali için gerekçe zorunlu (en az 3 karakter).' }
  }
  return { allowed: true, reason, alreadyCancelled: false }
}

export function isCollectedOrder(input: {
  status?: string | null
  paidAt?: string | null
  paymentMethod?: string | null
}): boolean {
  return input.paidAt != null
    && !COLLECTED_ORDER_SPEC.excludedStatuses.some((status) => status === input.status)
    && !COLLECTED_ORDER_SPEC.excludedPaymentMethods.some((method) => method === input.paymentMethod)
}
