'use server'

import { assertAccess } from '../auth/access'
import { getHourlySales, getSalesOverTime } from '../queries'

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
