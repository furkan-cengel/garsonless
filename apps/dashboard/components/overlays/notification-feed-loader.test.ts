import assert from 'node:assert/strict'
import test from 'node:test'
import { loadNotificationFeeds } from './notification-feed-loader'

test('rejected history still delivers the live list and resolves so loading can finish', async () => {
  let liveDelivered = false
  let historyError = false
  await loadNotificationFeeds({
    live: async () => [], history: async () => { throw new Error('lost connection') },
    onLive: () => { liveDelivered = true }, onLiveError: () => assert.fail('live feed is healthy'),
    onHistory: () => assert.fail('history failed'), onHistoryError: () => { historyError = true },
  })
  assert.equal(liveDelivered, true)
  assert.equal(historyError, true)
})

test('both failed sources settle without an unhandled rejection; a retry can succeed', async () => {
  let errors = 0
  let delivered = 0
  const callbacks = {
    onLive: () => { delivered++ }, onHistory: () => { delivered++ },
    onLiveError: () => { errors++ }, onHistoryError: () => { errors++ },
  }
  await loadNotificationFeeds({ ...callbacks, live: async () => { throw new Error('lost') }, history: async () => ({ error: 'unavailable' }) })
  assert.equal(errors, 2)
  await loadNotificationFeeds({ ...callbacks, live: async () => [], history: async () => ({ items: [], unread: 0 }) })
  assert.equal(delivered, 2)
})
