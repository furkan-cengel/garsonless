import assert from 'node:assert/strict'
import test from 'node:test'
import type { PanoOperationalSource } from '@garsonless/application/read-models'
import { projectPanoTableStatuses } from './pano-table-status-model'

const now = Date.parse('2026-07-29T12:00:00.000Z')

function source(overrides: Partial<PanoOperationalSource> = {}): PanoOperationalSource {
  return {
    errors: [],
    tables: [{ id: 'table-a', label: 'Masa 1', deletedAt: null }],
    openTableSessions: [],
    pendingServiceRequests: [],
    paymentMode: null,
    paymentConfigured: false,
    ...overrides,
  }
}

test('Pano maps the canonical empty, new, active and late states', () => {
  assert.equal(projectPanoTableStatuses(source(), now)[0]?.status, 'empty')

  const baseSession = {
    sessionId: 'session-a',
    tableId: 'table-a',
    openedAt: new Date(now - 10 * 60_000).toISOString(),
    total: 500,
    unpaidTotal: 500,
    splitSettledTotal: 0,
    splitDeclaredCashTotal: 0,
    orderCount: 0,
    hasUnfinished: false,
  }
  assert.equal(projectPanoTableStatuses(source({ openTableSessions: [baseSession] }), now)[0]?.status, 'new')
  assert.equal(projectPanoTableStatuses(source({
    openTableSessions: [{ ...baseSession, orderCount: 1, hasUnfinished: true }],
  }), now)[0]?.status, 'active')
  assert.equal(projectPanoTableStatuses(source({
    openTableSessions: [{ ...baseSession, openedAt: new Date(now - 45 * 60_000).toISOString() }],
  }), now)[0]?.status, 'late')
})

test('Pano displays the remaining split-payment amount and settled state', () => {
  const partial = projectPanoTableStatuses(source({ openTableSessions: [{
    sessionId: 'session-a',
    tableId: 'table-a',
    openedAt: new Date(now - 10 * 60_000).toISOString(),
    total: 820,
    unpaidTotal: 820,
    splitSettledTotal: 300,
    splitDeclaredCashTotal: 0,
    orderCount: 2,
    hasUnfinished: false,
  }] }), now)[0]
  assert.equal(partial?.total, 520)
  assert.equal(partial?.status, 'active')

  const paid = projectPanoTableStatuses(source({ openTableSessions: [{
    sessionId: 'session-a',
    tableId: 'table-a',
    openedAt: new Date(now - 10 * 60_000).toISOString(),
    total: 820,
    unpaidTotal: 820,
    splitSettledTotal: 820,
    splitDeclaredCashTotal: 0,
    orderCount: 2,
    hasUnfinished: false,
  }] }), now)[0]
  assert.equal(paid?.status, 'paid')
  assert.equal(paid?.splitSettledTotal, 820)
})

test('Pano separates sessions opened before the current restaurant day', () => {
  const restaurantDayStart = Date.parse('2026-07-29T03:00:00.000Z')
  const result = projectPanoTableStatuses(source({ openTableSessions: [{
    sessionId: 'session-old', tableId: 'table-a', openedAt: '2026-07-28T22:00:00.000Z',
    total: 80, unpaidTotal: 80, splitSettledTotal: 0, splitDeclaredCashTotal: 0,
    orderCount: 1, hasUnfinished: false,
  }] }), now, restaurantDayStart)[0]
  assert.equal(result?.status, 'stale')
  assert.equal(result?.isStaleSession, true)
})
