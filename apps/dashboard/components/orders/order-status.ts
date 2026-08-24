import type { OperationalOrderStatus } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'

const ACTIVE_STATUSES = new Set<OperationalOrderStatus>([
  'pending',
  'pending_approval',
  'sent_to_kitchen',
  'preparing',
  'ready',
])

export function orderStatusGroup(status: OperationalOrderStatus): 'new' | 'prep' | 'ready' | 'done' {
  if (status === 'pending' || status === 'pending_approval') return 'new'
  if (status === 'sent_to_kitchen' || status === 'preparing') return 'prep'
  if (status === 'ready') return 'ready'
  return 'done'
}

export function isActiveOrder(order: Pick<Order, 'status'>): boolean {
  return ACTIVE_STATUSES.has(order.status)
}

export function isCompletedOrder(order: Pick<Order, 'status'>): boolean {
  return order.status === 'served'
}

export function isCancelledOrder(order: Pick<Order, 'status'>): boolean {
  return order.status === 'cancelled'
}

export function orderStageStartedAt(order: Order): string {
  const group = orderStatusGroup(order.status)
  if (group === 'prep') return (order.sent_to_kitchen_at as string | null) ?? order.created_at
  if (group === 'ready') return (order.ready_at as string | null) ?? order.created_at
  return order.created_at
}

export type OrderUrgencyLevel = 'ok' | 'attention' | 'late' | 'done'

export type OrderUrgencyProjection = {
  group: ReturnType<typeof orderStatusGroup>
  minutes: number
  level: OrderUrgencyLevel
  attention: boolean
  late: boolean
  readyWaiting: boolean
}

export function projectOrderUrgency(
  order: Order,
  lateThresholdMin: number,
  now = Date.now(),
): OrderUrgencyProjection {
  const group = orderStatusGroup(order.status)
  const startedAt = new Date(orderStageStartedAt(order)).getTime()
  const minutes = Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((now - startedAt) / 60_000))
    : 0
  if (group === 'done') {
    return { group, minutes, level: 'done', attention: false, late: false, readyWaiting: false }
  }

  const threshold = group === 'prep'
    ? { attention: Math.max(1, Math.ceil(lateThresholdMin * 0.6)), late: Math.max(1, lateThresholdMin) }
    : { attention: 5, late: 10 }
  const late = minutes >= threshold.late
  const attention = minutes >= threshold.attention
  return {
    group,
    minutes,
    level: late ? 'late' : attention ? 'attention' : 'ok',
    attention,
    late,
    readyWaiting: group === 'ready' && minutes >= 5,
  }
}

export function formatOrderElapsedMinutes(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
  if (safeMinutes < 60) return `${safeMinutes} dk`
  const days = Math.floor(safeMinutes / 1_440)
  const hours = Math.floor((safeMinutes % 1_440) / 60)
  const remainder = safeMinutes % 60
  if (days > 0) return hours > 0 ? `${days} gün ${hours} sa` : `${days} gün`
  return remainder > 0 ? `${hours} sa ${remainder} dk` : `${hours} sa`
}

export function isLateOrder(order: Order, lateThresholdMin: number, now = Date.now()): boolean {
  return projectOrderUrgency(order, lateThresholdMin, now).late
}

export function isReadyWaitingOrder(order: Order, thresholdMin = 5, now = Date.now()): boolean {
  if (orderStatusGroup(order.status) !== 'ready') return false
  const startedAt = (order.ready_at as string | null) ?? order.created_at
  return Math.floor((now - new Date(startedAt).getTime()) / 60_000) >= thresholdMin
}
