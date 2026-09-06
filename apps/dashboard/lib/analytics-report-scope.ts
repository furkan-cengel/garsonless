import { restaurantDayKey } from '@garsonless/db/browser'
import type { AnalyticsQuery } from './analytics-filter-contract'

export interface AnalyticsReportScope {
  timezone: string
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
}

export function analyticsDateError(query: AnalyticsQuery, timezone: string, now = new Date()): string | null {
  if (query.range !== 'custom') return null
  const today = restaurantDayKey(now, timezone)
  return (query.from && query.from > today) || (query.to && query.to > today)
    ? 'Gelecek günler seçilemez. Restoranın bugünü veya önceki bir günü seçin.' : null
}
