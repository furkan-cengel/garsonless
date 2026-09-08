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

/** Compare the amount after a cents round trip, not the floating-point product.
 * For example, 19.99 * 100 is 1998.9999999999998 in JavaScript. */
export function isValidOrderRefundAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000
    && Math.round(amount * 100) / 100 === amount
}

/** Status exposed to operational read models. `paid` is a legacy storage value,
 * never a kitchen stage in application/UI contracts. */
export type OperationalOrderStatus = Exclude<OrderStatus, 'paid'>

/** Targets accepted by the generic lifecycle command. Payment and cancellation
 * have dedicated commands; entry states are never transition targets. */
export const ORDER_LIFECYCLE_TARGETS = [
  'sent_to_kitchen',
  'preparing',
  'ready',
  'served',
] as const
export type OrderLifecycleTarget = typeof ORDER_LIFECYCLE_TARGETS[number]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && [
    'pending',
    'pending_approval',
    'sent_to_kitchen',
    'preparing',
    'ready',
    'served',
    'paid',
    'cancelled',
  ].includes(value)
}

export function isOrderLifecycleTarget(value: unknown): value is OrderLifecycleTarget {
  return typeof value === 'string' && (ORDER_LIFECYCLE_TARGETS as readonly string[]).includes(value)
}

/** Converts the one remaining legacy storage status into its operational
 * meaning. Settlement remains represented exclusively by paid_at/method. */
export function normalizeOperationalOrderStatus(status: OrderStatus): OperationalOrderStatus {
  return status === 'paid' ? 'preparing' : status
}

/** Orders that still participate in the live operational queue. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'pending_approval',
  'sent_to_kitchen',
  'preparing',
  'ready',
  'served',
]

/** Orders that still require an operational action on the dashboard board.
 * Unlike a daily report, these remain visible across restaurant-day rollover. */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'pending_approval',
  'sent_to_kitchen',
  'preparing',
  'paid',
  'ready',
]

/**
 * Canonical collected-revenue specification. Database adapters translate this
 * data-only policy to PostgREST/SQL while browser code evaluates it directly.
 * A paid legacy row with a null method is collected; a comp is not revenue.
 * Lifecycle cancellation does not erase an already collected payment. Refunds
 * are represented by their own successful ledger entries.
 */
export const COLLECTED_ORDER_SPEC = {
  paidAtRequired: true,
  excludedStatuses: [],
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
    return { allowed: false, error: 'Bu sipariş online ödendi - doğrulanmış İyzico iade akışını kullanın.' }
  }
  if (input.paidAt !== null && input.paymentMethod === 'split') {
    return { allowed: false, error: 'Bu sipariş hesap bölüşme ile ödendi - pay iadeleri/iptali ayrı iade akışı gerektirir.' }
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
