import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimOrderNotificationDelivery,
  orderNotificationReceiptKey,
  type NotificationReceiptStore,
} from './notification-delivery'

function memoryStore(): NotificationReceiptStore {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

test('notification delivery is claimed once for the same restaurant order', () => {
  const receipts = new Set<string>()
  const store = memoryStore()

  assert.equal(claimOrderNotificationDelivery('r-1', 'o-1', receipts, store), true)
  assert.equal(claimOrderNotificationDelivery('r-1', 'o-1', receipts, store), false)
  assert.equal(claimOrderNotificationDelivery('r-1', 'o-2', receipts, store), true)
})

test('session receipt prevents replay after the board remounts', () => {
  const store = memoryStore()
  assert.equal(claimOrderNotificationDelivery('r-1', 'o-1', new Set(), store), true)
  assert.equal(claimOrderNotificationDelivery('r-1', 'o-1', new Set(), store), false)
})

test('receipt keys stay tenant scoped', () => {
  assert.notEqual(
    orderNotificationReceiptKey('r-1', 'o-1'),
    orderNotificationReceiptKey('r-2', 'o-1'),
  )
})
