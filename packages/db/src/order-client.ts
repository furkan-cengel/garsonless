export type { OrderStatus } from './enums'

export interface OrderCustomerTierSnapshot {
  version: 1
  name: string
  min: number
  color: string
  tierIndex: number
  lifetimePoints: number
  discountPct: number
  pointsMultiplier: number
  bonusStamps: number
  priorityService: boolean
}

type SnapshotTier = {
  name: string
  min: number
  color: string
  discountPct: number
  pointsMultiplier: number
  bonusStamps: number
  priorityService: boolean
}

/** Immutable order-time tier snapshot for kitchen/dashboard priority.
 *  Kept browser-safe so dashboard client views can read snapshots without
 *  bundling the server-only loyalty/OTP module. */
export function snapshotOrderCustomerTier(input: {
  tier: SnapshotTier
  tierIndex: number
  lifetimePoints: number
}): OrderCustomerTierSnapshot {
  return {
    version: 1,
    name: input.tier.name,
    min: input.tier.min,
    color: input.tier.color,
    tierIndex: input.tierIndex,
    lifetimePoints: Math.max(0, Math.floor(input.lifetimePoints)),
    discountPct: input.tier.discountPct,
    pointsMultiplier: input.tier.pointsMultiplier,
    bonusStamps: input.tier.bonusStamps,
    priorityService: input.tier.priorityService,
  }
}

export function readOrderCustomerTierSnapshot(value: unknown): OrderCustomerTierSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  const name = typeof o['name'] === 'string' ? o['name'].trim() : ''
  if (!name) return null
  const num = (k: string, d: number) => {
    const v = o[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : d
  }
  return {
    version: 1,
    name,
    min: Math.max(0, Math.floor(num('min', 0))),
    color: typeof o['color'] === 'string' && o['color'] ? o['color'] : '#c8922a',
    tierIndex: Math.max(0, Math.floor(num('tierIndex', 0))),
    lifetimePoints: Math.max(0, Math.floor(num('lifetimePoints', 0))),
    discountPct: Math.max(0, Math.min(100, Math.floor(num('discountPct', 0)))),
    pointsMultiplier: Math.max(0.1, Math.min(10, num('pointsMultiplier', 1))),
    bonusStamps: Math.max(0, Math.min(20, Math.floor(num('bonusStamps', 0)))),
    priorityService: o['priorityService'] === true,
  }
}

type OrderSortable = {
  id?: string
  created_at: string
  customer_tier?: unknown
}

export function orderHasPriorityService(order: { customer_tier?: unknown }): boolean {
  return readOrderCustomerTierSnapshot(order.customer_tier)?.priorityService === true
}

/** Priority-service orders bubble to the top; within priority groups, older
 *  orders stay first so the queue remains operationally fair. */
export function compareOrdersByPriorityThenCreatedAt(a: OrderSortable, b: OrderSortable): number {
  const ap = orderHasPriorityService(a)
  const bp = orderHasPriorityService(b)
  if (ap !== bp) return ap ? -1 : 1
  const at = Date.parse(a.created_at)
  const bt = Date.parse(b.created_at)
  const byTime = (Number.isFinite(at) ? at : 0) - (Number.isFinite(bt) ? bt : 0)
  if (byTime !== 0) return byTime
  return (a.id ?? '').localeCompare(b.id ?? '')
}

export function sortOrdersByPriorityThenCreatedAt<T extends OrderSortable>(orders: T[]): T[] {
  return [...orders].sort(compareOrdersByPriorityThenCreatedAt)
}
