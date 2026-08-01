import assert from 'node:assert/strict'
import test from 'node:test'
import type { OpenTableSession } from './tables'
import { projectTableOperation, TABLE_LATE_AFTER_MINUTES } from './table-operations'

const now = Date.parse('2026-07-29T12:00:00.000Z')

function session(input: Partial<OpenTableSession> = {}): OpenTableSession {
  return {
    sessionId: 'session-a',
    tableId: 'table-a',
    openedAt: new Date(now - 10 * 60_000).toISOString(),
    total: 1_000,
    unpaidTotal: 1_000,
    splitSettledTotal: 0,
    splitDeclaredCashTotal: 0,
    orderCount: 1,
    hasUnfinished: true,
    ...input,
  }
}

test('canonical projector uses the shared 45 minute boundary', () => {
  assert.equal(projectTableOperation(undefined, now).state, 'empty')
  assert.equal(projectTableOperation(session({ orderCount: 0 }), now).state, 'new')
  assert.equal(projectTableOperation(session(), now).state, 'open')
  assert.equal(projectTableOperation(session({
    openedAt: new Date(now - TABLE_LATE_AFTER_MINUTES * 60_000).toISOString(),
  }), now).state, 'late')
})

test('settled shares reduce the remaining amount without trusting declared cash', () => {
  const partial = projectTableOperation(session({
    unpaidTotal: 1_000,
    splitSettledTotal: 400,
    splitDeclaredCashTotal: 200,
  }), now)
  assert.equal(partial.remainingTotal, 600)
  assert.equal(partial.isSettled, false)

  const settled = projectTableOperation(session({
    unpaidTotal: 1_000,
    splitSettledTotal: 1_000,
    splitDeclaredCashTotal: 0,
    hasUnfinished: false,
  }), now)
  assert.equal(settled.remainingTotal, 0)
  assert.equal(settled.isSettled, true)
})

test('invalid and future timestamps remain safe', () => {
  assert.equal(projectTableOperation(session({ openedAt: 'invalid' }), now).elapsedMinutes, 0)
  assert.equal(projectTableOperation(session({
    openedAt: new Date(now + 60_000).toISOString(),
  }), now).elapsedMinutes, 0)
})
