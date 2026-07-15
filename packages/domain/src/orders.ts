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
  return input.paidAt != null && input.status !== 'cancelled' && input.paymentMethod !== 'comp'
}
