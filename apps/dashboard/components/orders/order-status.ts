import type { OrderStatus } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'

const ACTIVE_STATUSES = new Set<OrderStatus>([
  'pending',
  'pending_approval',
  'sent_to_kitchen',
  'preparing',
  'paid',
  'ready',
])

export function orderStatusGroup(status: OrderStatus): 'new' | 'prep' | 'ready' | 'done' {
  if (status === 'pending' || status === 'pending_approval') return 'new'
  // `paid` is a legacy operational status, not a terminal state. The order
  // still has to pass through kitchen/service, so every consumer treats it as
  // preparing until the schema separates payment and operational state fully.
  if (status === 'sent_to_kitchen' || status === 'preparing' || status === 'paid') return 'prep'
  if (status === 'ready') return 'ready'
  return 'done'
}

export function isActiveOrder(order: Pick<Order, 'status'>): boolean {
  return ACTIVE_STATUSES.has(order.status as OrderStatus)
}

export function isCompletedOrder(order: Pick<Order, 'status'>): boolean {
  return order.status === 'served'
}

export function isCancelledOrder(order: Pick<Order, 'status'>): boolean {
  return order.status === 'cancelled'
}

export function orderStageStartedAt(order: Order): string {
  const group = orderStatusGroup(order.status as OrderStatus)
  if (group === 'prep') return (order.sent_to_kitchen_at as string | null) ?? order.created_at
  if (group === 'ready') return (order.ready_at as string | null) ?? order.created_at
  return order.created_at
}

export function isLateOrder(order: Order, lateThresholdMin: number, now = Date.now()): boolean {
  if (orderStatusGroup(order.status as OrderStatus) !== 'prep') return false
  return Math.floor((now - new Date(orderStageStartedAt(order)).getTime()) / 60_000) > lateThresholdMin
}

export function isReadyWaitingOrder(order: Order, thresholdMin = 5, now = Date.now()): boolean {
  if (orderStatusGroup(order.status as OrderStatus) !== 'ready') return false
  const startedAt = (order.ready_at as string | null) ?? order.created_at
  return Math.floor((now - new Date(startedAt).getTime()) / 60_000) >= thresholdMin
}
