import { orderHasPriorityService, readOrderLineSnapshots } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'
import { isActiveOrder, isCancelledOrder, isCompletedOrder, projectOrderUrgency } from './order-status'

export type FilterId = 'all' | 'active' | 'attention' | 'late' | 'ready_wait' | 'unpaid' | 'priority' | 'done' | 'cancelled'
export type OrderSourceFilter = 'all' | Order['source']

export const FILTER_LABELS: Record<FilterId, string> = {
  all: 'Tümü', active: 'Aktif', attention: 'Dikkat gerekiyor', late: 'Geciken', ready_wait: 'Servis bekleyen',
  unpaid: 'Ödenmemiş', priority: 'Öncelikli', done: 'Tamamlandı', cancelled: 'İptal',
}

export const ORDER_SOURCE_LABELS: Record<Order['source'], string> = {
  customer: 'QR menü',
  staff: 'Personel',
}

export function orderMatchesSource(order: Order, source: OrderSourceFilter): boolean {
  return source === 'all' || order.source === source
}

export function orderMatchesView(order: Order, filter: FilterId, lateThresholdMin: number, now: number): boolean {
  const urgency = projectOrderUrgency(order, lateThresholdMin, now)
  if (filter === 'active') return isActiveOrder(order)
  if (filter === 'attention') return urgency.attention || (isActiveOrder(order) && orderHasPriorityService(order))
  if (filter === 'late') return urgency.late
  if (filter === 'ready_wait') return urgency.readyWaiting
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
    ORDER_SOURCE_LABELS[order.source],
    order.source,
    ...lines.flatMap(line => [line.name, line.station?.name ?? '', line.productNote ?? '']),
  ].join(' ').toLocaleLowerCase('tr-TR')
  return searchable.includes(query)
}
