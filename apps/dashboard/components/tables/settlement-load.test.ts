import assert from 'node:assert/strict'
import test from 'node:test'
import { clearRecentSettlementLoads, reuseSettlementLoad, SETTLEMENT_LOAD_ERROR, withSettlementLoadRetry, withSettlementLoadTimeout } from './settlement-load'

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

test('retries one transient read result without requiring a manual retry', async () => {
  let calls = 0
  const result = await withSettlementLoadRetry(
    async () => (++calls === 1 ? { error: SETTLEMENT_LOAD_ERROR } : { orders: 2 }),
    (value) => 'error' in value,
  )
  assert.deepEqual(result, { orders: 2 })
  assert.equal(calls, 2)
})

test('does not retry permanent validation failures', async () => {
  let calls = 0
  const result = await withSettlementLoadRetry(
    async () => { calls += 1; return { error: 'Geçersiz oturum' } },
    (value) => value.error === SETTLEMENT_LOAD_ERROR,
  )
  assert.deepEqual(result, { error: 'Geçersiz oturum' })
  assert.equal(calls, 1)
})

test('shares one in-flight read across development remounts', async () => {
  let calls = 0
  let resolveLoad: ((value: { orders: number }) => void) | undefined
  const load = () => {
    calls += 1
    return new Promise<{ orders: number }>((resolve) => { resolveLoad = resolve })
  }
  const first = reuseSettlementLoad('test:session-a', load)
  const second = reuseSettlementLoad('test:session-a', load)
  assert.equal(first, second)
  assert.equal(calls, 1)
  resolveLoad?.({ orders: 2 })
  assert.deepEqual(await second, { orders: 2 })
})

test('reuses a successful prefetched result during its short freshness window', async () => {
  let calls = 0
  const key = 'test:prefetch:session-a'
  const load = async () => ({ orders: ++calls })
  const first = await reuseSettlementLoad(key, load, { resultTtlMs: 1_000 })
  const second = await reuseSettlementLoad(key, load, { resultTtlMs: 1_000 })
  assert.deepEqual(first, { orders: 1 })
  assert.deepEqual(second, { orders: 1 })
  assert.equal(calls, 1)
  clearRecentSettlementLoads('test:prefetch:')
})

test('does not cache a result rejected by the cache policy', async () => {
  let calls = 0
  const key = 'test:prefetch:error'
  const load = async () => ({ error: `failure-${++calls}` })
  await reuseSettlementLoad(key, load, { resultTtlMs: 1_000, shouldCache: () => false })
  const second = await reuseSettlementLoad(key, load, { resultTtlMs: 1_000, shouldCache: () => false })
  assert.deepEqual(second, { error: 'failure-2' })
  assert.equal(calls, 2)
})

test('clears recent prefetched results by tenant-scoped prefix', async () => {
  let calls = 0
  const key = 'transfer:restaurant-a:session-a'
  const load = async () => ({ orders: ++calls })
  await reuseSettlementLoad(key, load, { resultTtlMs: 1_000 })
  clearRecentSettlementLoads('transfer:restaurant-a:')
  const refreshed = await reuseSettlementLoad(key, load, { resultTtlMs: 1_000 })
  assert.deepEqual(refreshed, { orders: 2 })
  clearRecentSettlementLoads('transfer:restaurant-a:')
})
