import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aggregateOpenTableSessions,
  type OpenSessionOrderRow,
  type OpenSessionRow,
  type OpenSessionShareRow,
} from './table-session-aggregation'

function countedIterable<T>(values: readonly T[]) {
  let iterationCount = 0
  return {
    iterable: {
      [Symbol.iterator]() {
        iterationCount += 1
        return values[Symbol.iterator]()
      },
    } satisfies Iterable<T>,
    count: () => iterationCount,
  }
}

test('open table aggregation preserves financial and operational semantics in one pass per collection', () => {
  const sessions = countedIterable<OpenSessionRow>([
    { id: 'session-a', table_id: 'table-a', opened_at: '2026-07-28T10:00:00.000Z' },
    { id: 'session-b', table_id: 'table-b', opened_at: '2026-07-28T11:00:00.000Z' },
  ])
  const orders = countedIterable<OpenSessionOrderRow>([
    { table_session_id: 'session-a', total: 100, status: 'served', paid_at: null },
    { table_session_id: 'session-a', total: 50, status: 'preparing', paid_at: '2026-07-28T10:30:00.000Z' },
    { table_session_id: 'session-a', total: 999, status: 'cancelled', paid_at: null },
    { table_session_id: 'session-b', total: 30, status: 'served', paid_at: null },
    { table_session_id: 'unknown-session', total: 500, status: 'served', paid_at: null },
  ])
  const shares = countedIterable<OpenSessionShareRow>([
    { table_session_id: 'session-a', amount: 40, method: 'card', status: 'settled' },
    { table_session_id: 'session-a', amount: 10, method: 'cash', status: 'declared' },
    { table_session_id: 'session-a', amount: 20, method: 'card', status: 'declared' },
    { table_session_id: 'session-b', amount: null, method: 'cash', status: 'settled' },
    { table_session_id: 'unknown-session', amount: 500, method: 'cash', status: 'settled' },
  ])

  assert.deepEqual(
    aggregateOpenTableSessions(sessions.iterable, orders.iterable, shares.iterable),
    [
      {
        sessionId: 'session-a',
        tableId: 'table-a',
        openedAt: '2026-07-28T10:00:00.000Z',
        total: 150,
        unpaidTotal: 100,
        splitSettledTotal: 40,
        splitDeclaredCashTotal: 10,
        orderCount: 2,
        hasUnfinished: true,
      },
      {
        sessionId: 'session-b',
        tableId: 'table-b',
        openedAt: '2026-07-28T11:00:00.000Z',
        total: 30,
        unpaidTotal: 30,
        splitSettledTotal: 0,
        splitDeclaredCashTotal: 0,
        orderCount: 1,
        hasUnfinished: false,
      },
    ],
  )
  assert.equal(sessions.count(), 1)
  assert.equal(orders.count(), 1)
  assert.equal(shares.count(), 1)
})

test('open table aggregation returns an empty projection without revisiting inputs', () => {
  const sessions = countedIterable<OpenSessionRow>([])
  const orders = countedIterable<OpenSessionOrderRow>([])
  const shares = countedIterable<OpenSessionShareRow>([])

  assert.deepEqual(
    aggregateOpenTableSessions(sessions.iterable, orders.iterable, shares.iterable),
    [],
  )
  assert.equal(sessions.count(), 1)
  assert.equal(orders.count(), 1)
  assert.equal(shares.count(), 1)
})
