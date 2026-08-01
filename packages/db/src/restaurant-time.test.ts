import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  customRangeWindow,
  startOfRestaurantDay, rangeWindow, restaurantDayKey, restaurantHour,
  restaurantWeekday, normalizeTimeZone, startOfDayNDaysAgo, DEFAULT_TIMEZONE,
} from './restaurant-time'

const iso = (d: Date) => d.toISOString()
// These assertions are ABSOLUTE UTC instants / keys — they must hold identically
// no matter what process.env.TZ the runner uses. The suite is run under
// TZ=UTC, TZ=Asia/Kolkata and the dev TZ; passing under all three PROVES the
// module reads its `tz` parameter, never the machine timezone.

test('startOfRestaurantDay — absolute local-midnight instants per zone', () => {
  // 14:00 Istanbul → that day's local midnight is 03-hours-back = 21:00Z prev day
  assert.equal(iso(startOfRestaurantDay('Europe/Istanbul', new Date('2026-07-04T11:00:00Z'))), '2026-07-03T21:00:00.000Z')
  // 01:30 Istanbul (July 5 local) → proves the +3 boundary: this instant is "July 5"
  assert.equal(iso(startOfRestaurantDay('Europe/Istanbul', new Date('2026-07-04T22:30:00Z'))), '2026-07-04T21:00:00.000Z')
  assert.equal(iso(startOfRestaurantDay('UTC', new Date('2026-07-04T11:00:00Z'))), '2026-07-04T00:00:00.000Z')
  // 07:00 EDT (-04) → local midnight = 04:00Z
  assert.equal(iso(startOfRestaurantDay('America/New_York', new Date('2026-07-04T11:00:00Z'))), '2026-07-04T04:00:00.000Z')
})

test('restaurantDayKey — same instant, different local calendar day per zone', () => {
  const at = new Date('2026-07-04T22:30:00Z')
  assert.equal(restaurantDayKey(at, 'Europe/Istanbul'), '2026-07-05') // 01:30 next day
  assert.equal(restaurantDayKey(at, 'UTC'), '2026-07-04')
  assert.equal(restaurantDayKey(at, 'America/New_York'), '2026-07-04') // 18:30 EDT
})

test('restaurantHour / restaurantWeekday in-zone', () => {
  const at = new Date('2026-07-04T11:00:00Z')
  assert.equal(restaurantHour(at, 'Europe/Istanbul'), 14)
  assert.equal(restaurantHour(at, 'UTC'), 11)
  assert.equal(restaurantHour(at, 'America/New_York'), 7)
  // 2026-07-04 is a Saturday → app weekday 5 (Mon=0)
  assert.equal(restaurantWeekday(at, 'Europe/Istanbul'), 5)
  // 22:30Z is July 5 (Sunday) in Istanbul → weekday 6
  assert.equal(restaurantWeekday(new Date('2026-07-04T22:30:00Z'), 'Europe/Istanbul'), 6)
})

test('rangeWindow — current/previous instants, fixed now', () => {
  const now = new Date('2026-07-04T11:00:00Z')
  const wk = rangeWindow('Europe/Istanbul', 'week', now)
  // week = 7 calendar days ending today; currentStart = 2026-06-28 00:00 IST = 06-27T21:00Z
  assert.equal(iso(wk.currentStart), '2026-06-27T21:00:00.000Z')
  assert.equal(iso(wk.previousStart), '2026-06-20T21:00:00.000Z') // 13 days back
  assert.equal(iso(wk.currentEnd), iso(now))
  const day = rangeWindow('Europe/Istanbul', 'day', now)
  assert.equal(iso(day.currentStart), '2026-07-03T21:00:00.000Z') // today 00:00 IST
  assert.equal(iso(day.previousStart), '2026-07-02T21:00:00.000Z') // yesterday 00:00 IST
  assert.equal(iso(day.currentEnd), iso(now))
})

test('yesterday and calendar month keep restaurant-local exclusive boundaries', () => {
  const now = new Date('2026-07-30T10:00:00Z')
  const yesterday = rangeWindow('Europe/Istanbul', 'yesterday', now)
  assert.equal(iso(yesterday.previousStart), '2026-07-27T21:00:00.000Z')
  assert.equal(iso(yesterday.currentStart), '2026-07-28T21:00:00.000Z')
  assert.equal(iso(yesterday.currentEnd), '2026-07-29T21:00:00.000Z')

  const month = rangeWindow('Europe/Istanbul', 'calendar_month', now)
  assert.equal(iso(month.currentStart), '2026-06-30T21:00:00.000Z')
  assert.equal(iso(month.currentEnd), iso(now))
  assert.equal(iso(month.previousStart), '2026-05-31T21:00:00.000Z')
})

test('custom range includes the complete to-day and creates an equal previous window', () => {
  const window = customRangeWindow(
    'Europe/Istanbul',
    '2026-07-01',
    '2026-07-03',
    new Date('2026-07-30T10:00:00Z'),
  )
  assert.equal(iso(window.previousStart), '2026-06-27T21:00:00.000Z')
  assert.equal(iso(window.currentStart), '2026-06-30T21:00:00.000Z')
  assert.equal(iso(window.currentEnd), '2026-07-03T21:00:00.000Z')
})

test('DST — Berlin spring-forward day is 23h, absolute midnights correct', () => {
  const d29 = startOfRestaurantDay('Europe/Berlin', new Date('2026-03-29T12:00:00Z'))
  const d30 = startOfRestaurantDay('Europe/Berlin', new Date('2026-03-30T12:00:00Z'))
  assert.equal(iso(d29), '2026-03-28T23:00:00.000Z') // 00:00 CET (+01)
  assert.equal(iso(d30), '2026-03-29T22:00:00.000Z') // 00:00 CEST (+02)
  assert.equal((d30.getTime() - d29.getTime()) / 3_600_000, 23) // spring-forward short day
})

test('DST — Berlin fall-back day is 25h, absolute midnights correct', () => {
  const d25 = startOfRestaurantDay('Europe/Berlin', new Date('2026-10-25T12:00:00Z'))
  const d26 = startOfRestaurantDay('Europe/Berlin', new Date('2026-10-26T12:00:00Z'))
  assert.equal(iso(d25), '2026-10-24T22:00:00.000Z') // 00:00 CEST (+02)
  assert.equal(iso(d26), '2026-10-25T23:00:00.000Z') // 00:00 CET (+01)
  assert.equal((d26.getTime() - d25.getTime()) / 3_600_000, 25) // fall-back long day
})

test('day iteration steps by CALENDAR day across DST (not ±24h)', () => {
  // Stepping back from 2026-03-31 by 1,2,3 calendar days must land on the 30,29,28
  // local midnights — crossing the 23h spring-forward day without drift.
  const from = new Date('2026-03-31T12:00:00Z')
  assert.equal(restaurantDayKey(startOfDayNDaysAgo('Europe/Berlin', 1, from), 'Europe/Berlin'), '2026-03-30')
  assert.equal(restaurantDayKey(startOfDayNDaysAgo('Europe/Berlin', 2, from), 'Europe/Berlin'), '2026-03-29')
  assert.equal(restaurantDayKey(startOfDayNDaysAgo('Europe/Berlin', 3, from), 'Europe/Berlin'), '2026-03-28')
})

test('INVARIANT the old getSalesOverTime broke: an order key == its day-start key', () => {
  // The bug: row bucketed by one key basis, output bucket by another → today
  // orphaned. Here: for ANY instant, the day key of the instant must equal the
  // day key of that day's local-midnight. Holds regardless of zone/DST.
  for (const tz of ['Europe/Istanbul', 'Europe/Berlin', 'America/New_York', 'UTC']) {
    for (const s of ['2026-07-04T22:30:00Z', '2026-03-29T00:30:00Z', '2026-10-25T00:30:00Z', '2026-01-01T03:00:00Z']) {
      const at = new Date(s)
      assert.equal(restaurantDayKey(at, tz), restaurantDayKey(startOfRestaurantDay(tz, at), tz),
        `day key drift for ${tz} @ ${s}`)
    }
  }
})

test('startOfRestaurantDay uses the PARAM tz, not the machine tz', () => {
  const at = new Date('2026-07-04T11:00:00Z')
  const ist = startOfRestaurantDay('Europe/Istanbul', at).getTime()
  const ny = startOfRestaurantDay('America/New_York', at).getTime()
  assert.notEqual(ist, ny)
  // IST midnight (03:00Z-back) vs NY midnight (04:00Z) → 7h apart on this date
  assert.equal((ny - ist) / 3_600_000, 7)
})

test('normalizeTimeZone — valid passes through, garbage → Istanbul', () => {
  assert.equal(normalizeTimeZone('Europe/Berlin'), 'Europe/Berlin')
  assert.equal(normalizeTimeZone('America/New_York'), 'America/New_York')
  assert.equal(normalizeTimeZone('Mars/Olympus'), DEFAULT_TIMEZONE)
  assert.equal(normalizeTimeZone(''), DEFAULT_TIMEZONE)
  assert.equal(normalizeTimeZone(null), DEFAULT_TIMEZONE)
  assert.equal(normalizeTimeZone(undefined), DEFAULT_TIMEZONE)
  assert.equal(normalizeTimeZone(42), DEFAULT_TIMEZONE)
  assert.equal(DEFAULT_TIMEZONE, 'Europe/Istanbul')
})
