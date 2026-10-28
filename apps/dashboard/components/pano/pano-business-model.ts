import type { PanoBusinessSource } from '@garsonless/application/read-models'
import { formatPanoCurrency } from '../../lib/pano-format'

export type PanoBusinessPeriod = 'today' | 7 | 30

interface PanoBusinessComparison {
  label: string
  value: string
  delta: string
  tone: 'up' | 'down' | 'flat'
}

interface PanoBusinessTile {
  label: string
  value: string
  sub: string
  tone: 'up' | 'down' | 'neutral'
}

export interface PanoBusinessBar {
  label: string
  /** Null for hours still ahead today. */
  current: number | null
  previous: number
}

export interface PanoBusinessView {
  revenueLabel: string
  revenue: string
  goal: { text: string; percent: number } | null
  comparisons: PanoBusinessComparison[]
  tiles: PanoBusinessTile[]
  chart: { title: string; currentLabel: string; previousLabel: string; bars: PanoBusinessBar[]; note: string }
}

/** "+%12", "−%5", "%0"; null when there is nothing to compare with. */
export function percentDelta(current: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (previous <= 0) return current > 0 ? { text: 'yeni', tone: 'up' } : { text: '—', tone: 'flat' }
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) return { text: '%0', tone: 'flat' }
  return change > 0 ? { text: `+%${change}`, tone: 'up' } : { text: `−%${Math.abs(change)}`, tone: 'down' }
}

// Whole liras: kuruş on an average reads as false precision.
const average = (revenue: number, count: number) => (count > 0 ? Math.round(revenue / count) : 0)

function signedMoney(value: number): string {
  if (Math.round(value) === 0) return '±₺0'
  return `${value > 0 ? '+' : '−'}${formatPanoCurrency(Math.abs(value))}`
}

function signedCount(value: number): string {
  return value === 0 ? '±0' : `${value > 0 ? '+' : '−'}${Math.abs(value)}`
}

function goalOf(revenue: number, target: number, label: string): PanoBusinessView['goal'] {
  if (target <= 0) return null
  const percent = Math.min(100, Math.round((revenue / target) * 100))
  const rest = target - revenue
  return {
    percent,
    text: `Hedef ${formatPanoCurrency(target)} (${label}) · %${percent}${rest > 0 ? ` · ${formatPanoCurrency(rest)} kaldı` : ' · hedef aşıldı'}`,
  }
}

/** Hours worth drawing: the span with sales on either day, never narrower than 9–22. */
function hourSpan(today: number[], previous: number[]): number[] {
  const busy = today.map((value, hour) => (value > 0 || (previous[hour] ?? 0) > 0 ? hour : -1)).filter((hour) => hour >= 0)
  const from = Math.min(9, ...busy)
  const to = Math.max(22, ...busy)
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

export function buildPanoBusinessView(
  business: PanoBusinessSource,
  period: PanoBusinessPeriod,
  context: { weekday: string; currentHour: number; openAmount: number; openTables: number },
): PanoBusinessView {
  if (period === 'today') {
    const { today, yesterday, lastWeekDay, hourly } = business
    const sameDay = `geçen ${context.weekday}`
    const yesterdayDelta = percentDelta(today.revenue, yesterday.sameTimeRevenue)
    const lastWeekDelta = percentDelta(today.revenue, lastWeekDay.sameTimeRevenue)
    const avgToday = average(today.revenue, today.paidOrders)
    const avgYesterday = average(yesterday.sameTimeRevenue, yesterday.sameTimePaidOrders)
    return {
      revenueLabel: 'Bugünkü ciro',
      revenue: formatPanoCurrency(today.revenue),
      goal: goalOf(today.revenue, lastWeekDay.revenue, `${sameDay} kadar`),
      comparisons: [
        { label: 'Dün aynı saatte', value: formatPanoCurrency(yesterday.sameTimeRevenue), delta: yesterdayDelta.text, tone: yesterdayDelta.tone },
        { label: `${capitalize(sameDay)} aynı saatte`, value: formatPanoCurrency(lastWeekDay.sameTimeRevenue), delta: lastWeekDelta.text, tone: lastWeekDelta.tone },
      ],
      tiles: [
        {
          label: 'Ortalama hesap',
          value: formatPanoCurrency(avgToday),
          sub: today.paidOrders && yesterday.sameTimePaidOrders ? `${signedMoney(avgToday - avgYesterday)} · dün aynı saat` : 'Dün aynı saatte hesap yok',
          tone: avgToday > avgYesterday ? 'up' : avgToday < avgYesterday ? 'down' : 'neutral',
        },
        {
          label: 'Ödenen sipariş',
          value: String(today.paidOrders),
          sub: `${signedCount(today.paidOrders - yesterday.sameTimePaidOrders)} · dün aynı saat`,
          tone: today.paidOrders > yesterday.sameTimePaidOrders ? 'up' : today.paidOrders < yesterday.sameTimePaidOrders ? 'down' : 'neutral',
        },
        {
          label: 'Açık tutar',
          value: formatPanoCurrency(context.openAmount),
          sub: context.openTables ? `${context.openTables} masada tahsil bekliyor` : 'Tahsil bekleyen masa yok',
          tone: 'neutral',
        },
      ],
      chart: {
        title: `Saatlik ciro · bugün ve ${sameDay}`,
        currentLabel: 'Bugün',
        previousLabel: capitalize(sameDay),
        bars: hourSpan(hourly.today, hourly.lastWeekDay).map((hour) => ({
          label: String(hour),
          current: hour > context.currentHour ? null : hourly.today[hour] ?? 0,
          previous: hourly.lastWeekDay[hour] ?? 0,
        })),
        note: business.peakHour === null
          ? 'Geçmiş haftalarda bu güne ait satış yok; karşılaştırma birkaç hafta sonra anlam kazanır.'
          : `Son dört haftada bu günün en yoğun saati ${String(business.peakHour).padStart(2, '0')}:00 oldu.`,
      },
    }
  }

  const { period: source } = business
  const days = source.days
  const delta = percentDelta(source.revenue, source.previousRevenue)
  const avgNow = average(source.revenue, source.paidOrders)
  const avgBefore = average(source.previousRevenue, source.previousPaidOrders)
  const busiest = source.daily.reduce<{ date: string; current: number } | null>((best, day) => (!best || day.current > best.current ? day : best), null)
  return {
    revenueLabel: `Son ${days} gün ciro`,
    revenue: formatPanoCurrency(source.revenue),
    goal: goalOf(source.revenue, source.previousRevenue, `önceki ${days} gün kadar`),
    comparisons: [{ label: `Önceki ${days} gün`, value: formatPanoCurrency(source.previousRevenue), delta: delta.text, tone: delta.tone }],
    tiles: [
      {
        label: 'Ortalama hesap',
        value: formatPanoCurrency(avgNow),
        sub: `${signedMoney(avgNow - avgBefore)} · önceki ${days} gün`,
        tone: avgNow > avgBefore ? 'up' : avgNow < avgBefore ? 'down' : 'neutral',
      },
      {
        label: 'Ödenen sipariş',
        value: String(source.paidOrders),
        sub: `${signedCount(source.paidOrders - source.previousPaidOrders)} · önceki ${days} gün`,
        tone: source.paidOrders > source.previousPaidOrders ? 'up' : source.paidOrders < source.previousPaidOrders ? 'down' : 'neutral',
      },
      days === 7 && busiest && busiest.current > 0
        ? { label: 'En yoğun gün', value: weekdayOf(busiest.date), sub: formatPanoCurrency(busiest.current), tone: 'neutral' }
        : { label: 'Günlük ortalama', value: formatPanoCurrency(source.revenue / days), sub: `Son ${days} gün`, tone: 'neutral' },
    ],
    chart: {
      title: `Günlük ciro · son ${days} gün ve önceki ${days} gün`,
      currentLabel: `Son ${days} gün`,
      previousLabel: `Önceki ${days} gün`,
      bars: source.daily.map((day) => ({
        label: days === 7 ? weekdayOf(day.date, 'short') : String(Number(day.date.slice(8, 10))),
        current: day.current,
        previous: day.previous,
      })),
      note: 'Bugün henüz bitmedi; son çubuk şu ana kadarki tahsilat.',
    },
  }
}

export function foodCostSummary(food: PanoBusinessSource['foodCost']): { percent: number; grossProfit: number; partial: boolean } | null {
  if (!food.hasSales || food.revenue <= 0) return null
  return {
    percent: Math.round((food.consumption / food.revenue) * 100),
    grossProfit: food.revenue - food.consumption,
    partial: food.missingCost,
  }
}

function weekdayOf(date: string, style: 'long' | 'short' = 'long'): string {
  // Noon UTC keeps the calendar day stable in every Turkish-region timezone.
  return capitalize(new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR', { weekday: style, timeZone: 'UTC' }))
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase('tr-TR') + value.slice(1)
}
