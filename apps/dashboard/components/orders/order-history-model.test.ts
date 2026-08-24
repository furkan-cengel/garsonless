import assert from 'node:assert/strict'
import test from 'node:test'
import { historyTerminalAt } from './order-history-model'

test('served history uses the persisted service timestamp', () => {
  assert.equal(historyTerminalAt({ status: 'served', served_at: '2026-08-01T09:20:00.000Z', updated_at: '2026-08-01T09:21:00.000Z' }), '2026-08-01T09:20:00.000Z')
})

test('cancelled and legacy served history safely use updated_at', () => {
  assert.equal(historyTerminalAt({ status: 'cancelled', served_at: null, updated_at: '2026-08-01T09:21:00.000Z' }), '2026-08-01T09:21:00.000Z')
  assert.equal(historyTerminalAt({ status: 'served', served_at: null, updated_at: '2026-08-01T09:21:00.000Z' }), '2026-08-01T09:21:00.000Z')
})
