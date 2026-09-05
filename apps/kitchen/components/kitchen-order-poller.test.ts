import assert from 'node:assert/strict'
import test from 'node:test'
import type { KitchenOrderProjectionBatch } from '@garsonless/application/tables'
import { createKitchenOrderPoller, type KitchenConnectionState } from './kitchen-order-poller'

const batch = { cursor: 'cursor-2', snapshot: true, orders: [] } as unknown as KitchenOrderProjectionBatch

test('rejects, preserves the last projection, pauses offline and recovers with a snapshot', async () => {
  let online = true
  let visible = true
  let time = 1000
  let reject = false
  let calls = 0
  let expired = false
  const cursors: unknown[] = []
  const states: KitchenConnectionState[] = []
  const applied: KitchenOrderProjectionBatch[] = []
  const poller = createKitchenOrderPoller({
    cursor: batch.cursor,
    read: async (cursor) => { calls++; cursors.push(cursor); if (reject) throw new Error('offline'); return { batch } },
    isOnline: () => online, isVisible: () => visible, now: () => time,
    onBatch: (value) => applied.push(value), onState: (value) => states.push(value), onExpired: () => { expired = true },
  })
  await poller.poll()
  assert.equal(states.at(-1)?.status, 'live')
  reject = true
  time = 2000
  await poller.poll()
  assert.equal(states.at(-1)?.status, 'stale')
  assert.equal(states.at(-1)?.lastSuccess, 1000)
  assert.equal(applied.length, 1)
  online = false
  await poller.poll()
  assert.equal(calls, 2)
  assert.equal(states.at(-1)?.status, 'offline')
  online = true; visible = false; reject = false
  await poller.poll(true)
  assert.equal(calls, 2)
  visible = true
  await poller.poll()
  assert.equal(cursors.at(-1), null)
  assert.equal(states.at(-1)?.status, 'live')
  assert.equal(expired, false)
  poller.stop()
  await poller.poll()
  assert.equal(calls, 3)
})

test('does not overlap a slow request or apply its response after disposal', async () => {
  let resolve!: (value: { batch: KitchenOrderProjectionBatch }) => void
  let calls = 0
  let applied = 0
  const poller = createKitchenOrderPoller({
    cursor: batch.cursor,
    read: () => { calls++; return new Promise((done) => { resolve = done }) },
    isOnline: () => true, isVisible: () => true, now: () => 1,
    onBatch: () => { applied++ }, onState: () => undefined, onExpired: () => undefined,
  })
  const pending = poller.poll()
  await poller.poll(true)
  assert.equal(calls, 1)
  poller.stop()
  resolve({ batch })
  await pending
  assert.equal(applied, 0)
})

test('expired authenticated session triggers reauthentication and never reports live', async () => {
  let expired = 0
  const states: KitchenConnectionState[] = []
  const poller = createKitchenOrderPoller({
    cursor: batch.cursor, read: async () => ({ error: 'Kitchen session expired' }),
    isOnline: () => true, isVisible: () => true, now: () => 1,
    onBatch: () => assert.fail('must not replace orders'), onState: (value) => states.push(value), onExpired: () => { expired++ },
  })
  await poller.poll()
  assert.equal(expired, 1)
  assert.equal(states.at(-1)?.status, 'stale')
})
