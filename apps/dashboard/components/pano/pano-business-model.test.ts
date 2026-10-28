import assert from 'node:assert/strict'
import test from 'node:test'
import type { PanoBusinessSource } from '@garsonless/application/read-models'
import { buildPanoBusinessView, foodCostSummary, percentDelta } from './pano-business-model'

const hours = (values: Record<number, number>) => Array.from({ length: 24 }, (_, hour) => values[hour] ?? 0)

const source: PanoBusinessSource = {
  today: { revenue: 1200, paidOrders: 4, cash: 300, comp: 50, cancelledCount: 1, cancelledTotal: 90 },
  yesterday: { revenue: 2000, paidOrders: 8, sameTimeRevenue: 1000, sameTimePaidOrders: 5 },
  lastWeekDay: { revenue: 3000, sameTimeRevenue: 1500 },
  hourly: { today: hours({ 10: 400, 12: 800 }), lastWeekDay: hours({ 9: 300, 12: 900, 20: 600 }) },
  peakHour: 12,
  period: {
    days: 7, revenue: 7000, paidOrders: 20, previousRevenue: 7000, previousPaidOrders: 25,
    daily: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-2${index + 2}`, current: index === 4 ? 2000 : 800, previous: 1000 })),
  },
  lowItems: [{ name: 'Nachos', count: 1 }],
  foodCost: { consumption: 300, revenue: 1000, hasSales: true, missingCost: true },
}
const context = { weekday: 'Pazartesi', currentHour: 13, openAmount: 450, openTables: 2 }

test('today compares with the same clock time yesterday and on the same weekday last week', () => {
  const view = buildPanoBusinessView(source, 'today', context)
  assert.equal(view.revenueLabel, 'Bugünkü ciro')
  assert.deepEqual(view.comparisons.map((c) => [c.label, c.delta, c.tone]), [
    ['Dün aynı saatte', '+%20', 'up'],
    ['Geçen Pazartesi aynı saatte', '−%20', 'down'],
  ])
  // The goal is last week's whole day, so the bar shows how far today is.
  assert.equal(view.goal?.percent, 40)
  assert.match(view.goal?.text ?? '', /geçen Pazartesi kadar/)
  assert.equal(view.tiles[2]?.sub, '2 masada tahsil bekliyor')
  // Hours after now are not drawn as zero sales.
  const bars = view.chart.bars
  assert.equal(bars[0]?.label, '9')
  assert.equal(bars.find((bar) => bar.label === '14')?.current, null)
  assert.equal(bars.find((bar) => bar.label === '12')?.current, 800)
  assert.equal(bars.at(-1)?.label, '22')
})

test('a period compares with the period before it and names the busiest day', () => {
  const view = buildPanoBusinessView(source, 7, context)
  assert.equal(view.revenueLabel, 'Son 7 gün ciro')
  assert.deepEqual(view.comparisons.map((c) => [c.label, c.delta]), [['Önceki 7 gün', '%0']])
  assert.equal(view.tiles[1]?.sub, '−5 · önceki 7 gün')
  assert.equal(view.tiles[2]?.label, 'En yoğun gün')
  assert.equal(view.chart.bars.length, 7)
})

test('nothing to compare with is said plainly', () => {
  assert.deepEqual(percentDelta(0, 0), { text: '—', tone: 'flat' })
  assert.deepEqual(percentDelta(100, 0), { text: 'yeni', tone: 'up' })
  const empty = { ...source, lastWeekDay: { revenue: 0, sameTimeRevenue: 0 } }
  assert.equal(buildPanoBusinessView(empty, 'today', context).goal, null)
})

test('food cost needs both stock sales and revenue', () => {
  assert.deepEqual(foodCostSummary(source.foodCost), { percent: 30, grossProfit: 700, partial: true })
  assert.equal(foodCostSummary({ ...source.foodCost, hasSales: false }), null)
  assert.equal(foodCostSummary({ ...source.foodCost, revenue: 0 }), null)
})
