import { orderHasPriorityService, readOrderLineSnapshots } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'
import { isActiveOrder, isCancelledOrder, isCompletedOrder, isLateOrder, isReadyWaitingOrder } from './order-status'

export type FilterId = 'all' | 'active' | 'attention' | 'late' | 'ready_wait' | 'unpaid' | 'priority' | 'done' | 'cancelled'

export const FILTER_LABELS: Record<FilterId, string> = {
  all: 'Tümü', active: 'Aktif', attention: 'Dikkat gerekiyor', late: 'Geciken', ready_wait: 'Servis bekleyen',
  unpaid: 'Ödenmemiş', priority: 'Öncelikli', done: 'Tamamlandı', cancelled: 'İptal',
}

export function orderMatchesView(order: Order, filter: FilterId, lateThresholdMin: number, now: number): boolean {
  if (filter === 'active') return isActiveOrder(order)
  if (filter === 'attention') return isLateOrder(order, lateThresholdMin, now) || isReadyWaitingOrder(order, 5, now) || (isActiveOrder(order) && orderHasPriorityService(order))
  if (filter === 'late') return isLateOrder(order, lateThresholdMin, now)
  if (filter === 'ready_wait') return isReadyWaitingOrder(order, 5, now)
  if (filter === 'unpaid') return isActiveOrder(order) && order.paid_at === null
  if (filter === 'priority') return isActiveOrder(order) && orderHasPriorityService(order)
  if (filter === 'done') return isCompletedOrder(order)
  if (filter === 'cancelled') return isCancelledOrder(order)
  return true
}

export function orderStationNames(order: Order): string[] {
  return [...new Set(readOrderLineSnapshots(order.items).map(line => line.station?.name).filter((name): name is string => Boolean(name)))]
}

export function normalizeOrderSearch(search: string): string {
  return search.trim().replace(/^#/, '').toLocaleLowerCase('tr-TR')
}

export function orderMatchesSearch(order: Order, tableLabel: string, search: string): boolean {
  const query = normalizeOrderSearch(search)
  if (!query) return true
  const lines = readOrderLineSnapshots(order.items)
  const searchable = [
    order.id,
    tableLabel,
    order.payment_method ?? '',
    ...lines.flatMap(line => [line.name, line.station?.name ?? '']),
  ].join(' ').toLocaleLowerCase('tr-TR')
  return searchable.includes(query)
}
