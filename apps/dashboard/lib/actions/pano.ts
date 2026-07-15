'use server'

import { assertAccess, getUserRestaurantAccess } from '../auth/access'
import { getHourlySales, getPanoSnapshot, getRestaurantTimezone, getSalesOverTime, getTableStatuses } from '../queries'
import type { TableStatusData } from '../queries'
import type { PanoSnapshot } from '../queries'
import { readOrderLineSnapshots, restaurantHour } from '@garsonless/db/order-client'
import { readPanoTableDetail } from '@garsonless/application/read-models'
import { createPanoTableDetailReadModelPort } from '@garsonless/db/server'

export type PanoChartRange = 'day' | 'week' | 'month'

export interface PanoChartPoint {
  label: string
  value: number
  /** the "now" bar (current hour) in the day view */
  highlight?: boolean
}

export interface PanoChartData {
  range: PanoChartRange
  rangeLabel: string
  points: PanoChartPoint[]
  total: number
  peakLabel: string
  peakValue: number
}

export interface TableDetailItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
  modifiers: string[]
  removedIngredients: string[]
}

export interface TableDetailOrder {
  id: string
  status: string
  total: number
  paidAt: string | null
  paymentMethod: string | null
  createdAt: string
  items: TableDetailItem[]
}

export interface PanoTableDetail {
  sessionId: string
  openedAt: string
  orders: TableDetailOrder[]
}

function readLineItems(orderId: string, value: unknown): TableDetailItem[] {
  return readOrderLineSnapshots(value).map((line, index) => {
    const unitPrice = line.price + line.modifiersPriceDelta
    return {
      id: `${orderId}-${index}`,
      name: line.name,
      quantity: line.quantity,
      unitPrice,
      total: unitPrice * line.quantity,
      modifiers: line.modifiers.map((modifier) => modifier.optionName),
      removedIngredients: line.removedIngredients.map((ingredient) => ingredient.name),
    }
  })
}

export async function fetchPanoTableStatuses(
  restaurantId: string,
): Promise<{ error: string } | { tables: TableStatusData[] }> {
  const gate = await assertAccess(restaurantId, 'pano')
  if ('error' in gate) return { error: gate.error }
  return { tables: await getTableStatuses(restaurantId) }
}

export async function fetchPanoSnapshot(
  restaurantId: string,
): Promise<{ error: string } | { snapshot: PanoSnapshot }> {
  const gate = await assertAccess(restaurantId, 'pano')
  if ('error' in gate) return { error: gate.error }
  const access = await getUserRestaurantAccess(restaurantId)
  if (!access) return { error: 'Not authorized' }
  try {
    return { snapshot: await getPanoSnapshot(restaurantId, access.isOwner) }
  } catch {
    return { error: 'Pano verileri alınamadı.' }
  }
}

export async function fetchPanoTableDetail(
  restaurantId: string,
  tableId: string,
): Promise<{ error: string } | PanoTableDetail> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }
  const detail = await readPanoTableDetail(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    { restaurantId, tableId },
    createPanoTableDetailReadModelPort(),
  )
  if (!detail.ok) return { error: detail.error }

  return {
    sessionId: detail.value.sessionId,
    openedAt: detail.value.openedAt,
    orders: detail.value.orders.map((row) => ({
      id: row.id,
      status: row.status,
      total: row.total,
      paidAt: row.paidAt,
      paymentMethod: row.paymentMethod,
      createdAt: row.createdAt,
      items: readLineItems(row.id, row.items),
    })),
  }
}

function finalize(range: PanoChartRange, rangeLabel: string, points: PanoChartPoint[]): PanoChartData {
  const total = points.reduce((s, p) => s + p.value, 0)
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0] ?? { label: '', value: 0 })
  return { range, rangeLabel, points, total, peakLabel: peak.label, peakValue: peak.value }
}

/**
 * Range-aware Pano revenue chart. 'day' → today's paid revenue by hour;
 * 'week'/'month' → paid revenue per day (getSalesOverTime, paid-only). Gated to
 * the 'pano' section (owner always passes).
 */
export async function fetchPanoChart(
  restaurantId: string,
  range: PanoChartRange,
): Promise<{ error: string } | PanoChartData> {
  const gate = await assertAccess(restaurantId, 'pano')
  if ('error' in gate) return { error: gate.error }

  if (range === 'day') {
    const [hourly, timezone] = await Promise.all([
      getHourlySales(restaurantId),
      getRestaurantTimezone(restaurantId),
    ])
    const currentHour = restaurantHour(new Date(), timezone)
    const points: PanoChartPoint[] = hourly
      .map((d) => ({ label: String(d.hour).padStart(2, '0'), value: d.total, highlight: d.hour === currentHour }))
    return finalize('day', 'Bugün', points)
  }

  const series = await getSalesOverTime(restaurantId, range === 'week' ? 'week' : 'month')
  const points: PanoChartPoint[] = series.map((d) => ({ label: d.date, value: d.current }))
  return finalize(range, range === 'week' ? 'Son 7 gün' : 'Son 30 gün', points)
}
