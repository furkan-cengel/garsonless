'use server'

import { assertAccess } from '../auth/access'
import { createDashboardServerClient } from '../supabase-server'
import { getHourlySales, getSalesOverTime, getTableStatuses } from '../queries'
import type { TableStatusData } from '../queries'
import { readOrderLineSnapshots } from '@garsonless/db/order-client'

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

export async function fetchPanoTableDetail(
  restaurantId: string,
  tableId: string,
): Promise<{ error: string } | PanoTableDetail> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }

  const supabase = await createDashboardServerClient()
  const { data: session } = await supabase
    .from('table_sessions')
    .select('id, opened_at')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .is('closed_at', null)
    .maybeSingle()

  if (!session) return { error: 'Bu masada açık adisyon yok.' }
  const sessionRow = session as unknown as { id: string; opened_at: string }

  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total, paid_at, payment_method, created_at, items')
    .eq('restaurant_id', restaurantId)
    .eq('table_session_id', sessionRow.id)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const rows = (data ?? []) as Array<{
    id: string
    status: string
    total: number | null
    paid_at: string | null
    payment_method: string | null
    created_at: string
    items: unknown
  }>

  return {
    sessionId: sessionRow.id,
    openedAt: sessionRow.opened_at,
    orders: rows.map((row) => ({
      id: row.id,
      status: row.status,
      total: Number(row.total ?? 0),
      paidAt: row.paid_at,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
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
    const hourly = await getHourlySales(restaurantId)
    const currentHour = new Date().getHours()
    const points: PanoChartPoint[] = hourly
      .filter((d) => d.hour >= 7 && d.hour <= 22)
      .map((d) => ({ label: String(d.hour).padStart(2, '0'), value: d.total, highlight: d.hour === currentHour }))
    return finalize('day', 'Bugün', points)
  }

  const series = await getSalesOverTime(restaurantId, range === 'week' ? 'week' : 'month')
  const points: PanoChartPoint[] = series.map((d) => ({ label: d.date, value: d.current }))
  return finalize(range, range === 'week' ? 'Son 7 gün' : 'Son 30 gün', points)
}
