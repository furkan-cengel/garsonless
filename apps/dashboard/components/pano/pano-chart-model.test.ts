import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDayPanoChart,
  dayPointsFromHourly,
  hourInTimezone,
  summarizePanoChartPoints,
} from '../../lib/pano-chart-model'

const now = new Date('2026-07-20T06:00:00.000Z')
const hourly = [
  { hour: 8, total: 25 },
  { hour: 9, total: 70 },
  { hour: 10, total: 40 },
]

test('Pano day chart labels hourly sales and highlights the restaurant-local current hour', () => {
  assert.equal(hourInTimezone('Europe/Istanbul', now), 9)
  assert.deepEqual(dayPointsFromHourly(hourly, 'Europe/Istanbul', now), [
    { label: '08', value: 25, highlight: false },
    { label: '09', value: 70, highlight: true },
    { label: '10', value: 40, highlight: false },
  ])
})

test('Pano chart summaries retain total and peak semantics for populated and empty ranges', () => {
  assert.deepEqual(summarizePanoChartPoints([]), { total: 0, peakLabel: '', peakValue: 0 })
  assert.deepEqual(createDayPanoChart(hourly, 'Europe/Istanbul', now), {
    range: 'day',
    rangeLabel: 'Bugün',
    points: [
      { label: '08', value: 25, highlight: false },
      { label: '09', value: 70, highlight: true },
      { label: '10', value: 40, highlight: false },
    ],
    total: 135,
    peakLabel: '09',
    peakValue: 70,
  })
})
