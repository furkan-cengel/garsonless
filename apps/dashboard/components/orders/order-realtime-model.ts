import {
  isOrderStatus,
  normalizeOperationalOrderStatus,
} from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'

export const ORDERS_REALTIME_SAFETY_INTERVAL_MS = 45_000

export type OrdersRealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

export const ORDERS_REALTIME_COPY: Record<OrdersRealtimeStatus, string> = {
  connecting: 'Canlı sipariş akışına bağlanılıyor…',
  live: 'Canlı',
  reconnecting: 'Siparişler yeniden uzlaştırılıyor…',
  offline: 'Canlı bağlantı kesildi. Son alınan siparişler gösteriliyor.',
}

export function normalizeRealtimeOrder(raw: Record<string, unknown>): Order | null {
  if (!isOrderStatus(raw['status'])) return null
  if (raw['source'] !== 'customer' && raw['source'] !== 'staff') return null
  if (typeof raw['id'] !== 'string' || typeof raw['restaurant_id'] !== 'string') return null
  return {
    ...raw,
    status: normalizeOperationalOrderStatus(raw['status']),
    source: raw['source'],
  } as Order
}

function revision(order: Order): number {
  const parsed = Date.parse(order.updated_at ?? order.created_at)
  return Number.isFinite(parsed) ? parsed : 0
}

export function upsertCanonicalOrder(current: Order[], incoming: Order): Order[] {
  if (incoming['deleted_at'] != null) return removeCanonicalOrder(current, incoming.id)
  const index = current.findIndex((order) => order.id === incoming.id)
  if (index < 0) return [incoming, ...current]
  if (revision(incoming) < revision(current[index]!)) return current
  const next = [...current]
  next[index] = incoming
  return next
}

export function removeCanonicalOrder(current: Order[], orderId: string): Order[] {
  return current.some((order) => order.id === orderId)
    ? current.filter((order) => order.id !== orderId)
    : current
}

export function canonicalOrderSnapshot(rows: Order[]): Order[] {
  const byId = new Map<string, Order>()
  for (const row of rows) {
    const existing = byId.get(row.id)
    if (!existing || revision(row) >= revision(existing)) byId.set(row.id, row)
  }
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function rollbackOrderStatus(
  current: Order[],
  orderId: string,
  optimisticStatus: Order['status'],
  fallbackStatus: Order['status'],
): Order[] {
  return current.map((order) => order.id === orderId && order.status === optimisticStatus
    ? { ...order, status: fallbackStatus }
    : order)
}
