import assert from 'node:assert/strict'
import test from 'node:test'

import { applyCalendarDate, applyClockTime, buildCalendarDays } from './date-time-picker'

test('calendar grid starts on Monday and always contains six complete weeks', () => {
  const days = buildCalendarDays(new Date(2026, 7, 1))

  assert.equal(days.length, 42)
  assert.equal(days[0]?.date.getDay(), 1)
  assert.equal(days.filter((day) => day.inCurrentMonth).length, 31)
})

test('changing the calendar day preserves time and changing time preserves the day', () => {
  const initial = new Date(2026, 7, 18, 12, 49)
  const selected = applyCalendarDate(initial, new Date(2026, 7, 31))
  const timed = applyClockTime(selected, '21:15')

  assert.deepEqual(
    [selected.getFullYear(), selected.getMonth(), selected.getDate(), selected.getHours(), selected.getMinutes()],
    [2026, 7, 31, 12, 49],
  )
  assert.deepEqual(
    [timed.getFullYear(), timed.getMonth(), timed.getDate(), timed.getHours(), timed.getMinutes()],
    [2026, 7, 31, 21, 15],
  )
})

test('invalid time input leaves the draft unchanged', () => {
  const initial = new Date(2026, 7, 18, 12, 49)
  assert.equal(applyClockTime(initial, '99:99'), initial)
})
