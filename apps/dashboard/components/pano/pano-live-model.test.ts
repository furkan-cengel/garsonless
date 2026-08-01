import assert from 'node:assert/strict'
import test from 'node:test'
import { PANO_STALE_AFTER_MS, projectPanoLiveStatus } from './pano-live-model'

const now = Date.parse('2026-07-30T08:00:00.000Z')

test('Pano live status distinguishes connecting, live, stale, offline and refresh errors', () => {
  assert.equal(projectPanoLiveStatus({ channel: 'connecting', lastSuccessfulAt: now, now, refreshFailed: false }), 'connecting')
  assert.equal(projectPanoLiveStatus({ channel: 'live', lastSuccessfulAt: now, now, refreshFailed: false }), 'live')
  assert.equal(projectPanoLiveStatus({ channel: 'live', lastSuccessfulAt: now - PANO_STALE_AFTER_MS - 1, now, refreshFailed: false }), 'stale')
  assert.equal(projectPanoLiveStatus({ channel: 'offline', lastSuccessfulAt: now, now, refreshFailed: false }), 'offline')
  assert.equal(projectPanoLiveStatus({ channel: 'live', lastSuccessfulAt: now, now, refreshFailed: true }), 'error')
})

test('offline and connecting channel state take precedence over snapshot age', () => {
  assert.equal(projectPanoLiveStatus({ channel: 'offline', lastSuccessfulAt: 0, now, refreshFailed: true }), 'offline')
  assert.equal(projectPanoLiveStatus({ channel: 'connecting', lastSuccessfulAt: 0, now, refreshFailed: true }), 'connecting')
})
