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

export type DomainEventType =
  | 'order.created'
  | 'order.status_changed'
  | 'order.settled'
  | 'table_session.closed'
  | 'service_request.created'

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  type: T
  restaurantId: string
  aggregateType: T extends `order.${string}` ? 'order' : T extends `table_session.${string}` ? 'table_session' : 'service_request'
  aggregateId: string
  payload: Record<string, unknown>
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
