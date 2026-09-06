import assert from 'node:assert/strict'
import test from 'node:test'
import { historyMatchesSearch, historyTerminalAt } from './order-history-model'

test('history finds displayed order references and Turkish table names', () => {
  const id = 'ea21a600-2b10-457c-9cd0-de889e86b044'
  for (const query of ['#EA21A6', ' ea21a6 ', 'iç salon', 'İÇ SALON', '']) {
    assert.equal(historyMatchesSearch(id, 'İç Salon 4', query), true, query)
  }
  assert.equal(historyMatchesSearch(id, 'İç Salon 4', '#BBBBBB'), false)
  assert.equal(historyMatchesSearch(id, 'Kasa', 'kasa'), true)
})

test('served history uses the persisted service timestamp', () => {
  assert.equal(historyTerminalAt({ status: 'served', served_at: '2026-08-01T09:20:00.000Z', updated_at: '2026-08-01T09:21:00.000Z' }), '2026-08-01T09:20:00.000Z')
})

test('cancelled and legacy served history safely use updated_at', () => {
  assert.equal(historyTerminalAt({ status: 'cancelled', served_at: null, updated_at: '2026-08-01T09:21:00.000Z' }), '2026-08-01T09:21:00.000Z')
  assert.equal(historyTerminalAt({ status: 'served', served_at: null, updated_at: '2026-08-01T09:21:00.000Z' }), '2026-08-01T09:21:00.000Z')
})
