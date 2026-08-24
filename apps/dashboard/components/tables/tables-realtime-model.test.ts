import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TABLES_REALTIME_COPY,
  TABLES_REALTIME_SAFETY_INTERVAL_MS,
  realtimeStatusTone,
} from './tables-realtime-model'

test('tables realtime copy distinguishes every connection state in Turkish', () => {
  assert.deepEqual(TABLES_REALTIME_COPY, {
    connecting: 'Canlı güncelleme bağlanıyor',
    live: 'Canlı güncelleme bağlı',
    reconnecting: 'Canlı güncelleme yeniden bağlanıyor',
    stale: 'Veriler güncel olmayabilir',
    offline: 'Canlı güncelleme kesildi',
  })
})

test('tables realtime safety reconciliation runs every 45 seconds', () => {
  assert.equal(TABLES_REALTIME_SAFETY_INTERVAL_MS, 45_000)
})

test('tables realtime tones fail visibly when synchronization is unavailable', () => {
  assert.equal(realtimeStatusTone('live'), 'positive')
  assert.equal(realtimeStatusTone('connecting'), 'warning')
  assert.equal(realtimeStatusTone('reconnecting'), 'warning')
  assert.equal(realtimeStatusTone('stale'), 'critical')
  assert.equal(realtimeStatusTone('offline'), 'critical')
})
