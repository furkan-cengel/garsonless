import type { AnalyticsCancellationAggregate } from '@garsonless/application/read-models'
import { restaurantCalendarDayCount, restaurantDayKey, startOfDayNDaysAgo } from '@garsonless/db/browser'
import type { CancellationReport } from './queries/analytics-operations'

function pctChange(current: number, previous: number): number | null {
  if (previous > 0) return Math.round(((current - previous) / previous) * 1000) / 10
  return current > 0 ? null : 0
}

export function projectCancellationAggregate(
  aggregate: AnalyticsCancellationAggregate,
  timezone: string,
  currentStart: Date,
  currentEnd: Date,
): CancellationReport {
  const lastInstant = new Date(Math.max(currentStart.getTime(), currentEnd.getTime() - 1))
  const days = restaurantCalendarDayCount(
    restaurantDayKey(currentStart, timezone),
    restaurantDayKey(lastInstant, timezone),
  )
  const byHour = new Map(aggregate.trend.map((row) => [row.hour, row.count]))
  const byDay = new Map<string, number>()
  for (const row of aggregate.trend) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.count)
  const trend = days === 1
    ? Array.from({ length: 24 }, (_, hour) => ({
        date: `${hour.toString().padStart(2, '0')}:00`, count: byHour.get(hour) ?? 0,
      }))
    : Array.from({ length: days }, (_, index) => {
        const dayStart = startOfDayNDaysAgo(timezone, -index, currentStart)
        return {
          date: dayStart.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', timeZone: timezone }),
          count: byDay.get(restaurantDayKey(dayStart, timezone)) ?? 0,
        }
      })
  const rate = aggregate.current.allOrders > 0
    ? Math.round((aggregate.current.cancelledCount / aggregate.current.allOrders) * 1000) / 10
    : 0
  const previousRate = aggregate.previous.allOrders > 0
    ? (aggregate.previous.cancelledCount / aggregate.previous.allOrders) * 100
    : 0
  return {
    count: aggregate.current.cancelledCount,
    lostAmount: aggregate.current.lostAmount,
    collectedCancelledCount: aggregate.current.collectedCancelledCount,
    collectedCancelledAmount: aggregate.current.collectedCancelledAmount,
    compCancelledCount: aggregate.current.compCancelledCount,
    compCancelledAmount: aggregate.current.compCancelledAmount,
    allOrders: aggregate.current.allOrders,
    rate,
    topItems: aggregate.topItems,
    trend,
    deltaCount: pctChange(aggregate.current.cancelledCount, aggregate.previous.cancelledCount),
    deltaLost: pctChange(aggregate.current.lostAmount, aggregate.previous.lostAmount),
    deltaRate: Math.round((rate - previousRate) * 10) / 10,
  }
}
