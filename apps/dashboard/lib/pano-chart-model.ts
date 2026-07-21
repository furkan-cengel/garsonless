import type { HourlySale } from './queries/pano'

export type PanoChartRange = 'day' | 'week' | 'month'

export interface PanoChartPoint {
  label: string
  value: number
  /** The current-hour bar in the day view. */
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

export const PANO_CHART_RANGES: ReadonlyArray<{ label: string; range: PanoChartRange }> = [
  { label: 'Bugün', range: 'day' },
  { label: '7 gün', range: 'week' },
  { label: '30 gün', range: 'month' },
]

export function hourInTimezone(timezone: string, now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now))
}

export function dayPointsFromHourly(hourly: HourlySale[], timezone: string, now = new Date()): PanoChartPoint[] {
  const currentHour = hourInTimezone(timezone, now)
  return hourly.map((row) => ({
    label: String(row.hour).padStart(2, '0'),
    value: row.total,
    highlight: row.hour === currentHour,
  }))
}

export function summarizePanoChartPoints(points: PanoChartPoint[]): Pick<PanoChartData, 'total' | 'peakLabel' | 'peakValue'> {
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const peak = points.reduce((current, point) => (point.value > current.value ? point : current), points[0] ?? { label: '', value: 0 })
  return { total, peakLabel: peak.label, peakValue: peak.value }
}

export function createDayPanoChart(hourly: HourlySale[], timezone: string, now = new Date()): PanoChartData {
  const points = dayPointsFromHourly(hourly, timezone, now)
  return { range: 'day', rangeLabel: 'Bugün', points, ...summarizePanoChartPoints(points) }
}
