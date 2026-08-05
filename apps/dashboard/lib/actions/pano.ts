'use server'

import { assertAccess } from '../auth/access'
import { getSalesOverTime } from '../queries/analytics'
import { getRestaurantTimezone } from '../queries/insights-shared'
import { getHourlySales, getPanoSnapshot } from '../queries/pano'
import type { PanoSnapshot } from '../queries/pano'
import { restaurantHour } from '@garsonless/db/browser'
import type { PanoChartData, PanoChartPoint, PanoChartRange } from '../pano-chart-model'

export async function fetchPanoSnapshot(
  restaurantId: string,
): Promise<{ error: string } | { snapshot: PanoSnapshot }> {
  const gate = await assertAccess(restaurantId, 'pano')
  if ('error' in gate) return { error: gate.error }
  try {
    return { snapshot: await getPanoSnapshot(restaurantId) }
  } catch {
    return { error: 'Pano verileri alınamadı.' }
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

  const series = await getSalesOverTime(restaurantId, range === 'week' ? 'week' : 'month', 'pano')
  const points: PanoChartPoint[] = series.map((d) => ({ label: d.date, value: d.current }))
  return finalize(range, range === 'week' ? 'Son 7 gün' : 'Son 30 gün', points)
}
