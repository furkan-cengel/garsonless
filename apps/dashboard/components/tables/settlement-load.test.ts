import assert from 'node:assert/strict'
import test from 'node:test'
import { SETTLEMENT_LOAD_ERROR, withSettlementLoadTimeout } from './settlement-load'

test('returns the settlement result before the deadline', async () => {
  const result = await withSettlementLoadTimeout(async () => ({ orders: 2 }), 50)
  assert.deepEqual(result, { orders: 2 })
})

test('preserves an upstream rejection', async () => {
  await assert.rejects(
    withSettlementLoadTimeout(async () => { throw new Error('upstream') }, 50),
    /upstream/,
  )
})

test('rejects a stalled request with a stable user-facing error', async () => {
  await assert.rejects(
    withSettlementLoadTimeout(() => new Promise(() => undefined), 5),
    new RegExp(SETTLEMENT_LOAD_ERROR.replace('.', '\\.')),
  )
})
