import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  DEFAULT_NOTIFICATION_INBOX_PREFS,
  isMutableNotification,
  notificationDedupeKey,
  readNotificationInboxPrefs,
  shouldDeliverInApp,
} from './notifications'

test('billing and system notifications are never mutable', () => {
  assert.equal(isMutableNotification('billing', 'info'), false)
  assert.equal(isMutableNotification('system', 'warning'), false)
  assert.equal(isMutableNotification('order', 'info'), true)
  assert.equal(isMutableNotification('service_request', 'warning'), true)
})

test('critical severity is unmutable in every category', () => {
  assert.equal(isMutableNotification('order', 'critical'), false)
  assert.equal(isMutableNotification('service_request', 'critical'), false)
})

test('dedupe key is deterministic per event + aggregate', () => {
  assert.equal(notificationDedupeKey('order.created', 'abc'), 'order.created:abc')
  assert.equal(
    notificationDedupeKey('order.created', 'abc'),
    notificationDedupeKey('order.created', 'abc'),
  )
  assert.notEqual(
    notificationDedupeKey('order.created', 'abc'),
    notificationDedupeKey('service_request.created', 'abc'),
  )
})

test('prefs: garbage input fails open to defaults', () => {
  assert.deepEqual(readNotificationInboxPrefs(null), DEFAULT_NOTIFICATION_INBOX_PREFS)
  assert.deepEqual(readNotificationInboxPrefs('junk'), DEFAULT_NOTIFICATION_INBOX_PREFS)
  assert.deepEqual(readNotificationInboxPrefs([]), DEFAULT_NOTIFICATION_INBOX_PREFS)
  assert.deepEqual(readNotificationInboxPrefs({ inapp: 'junk' }), DEFAULT_NOTIFICATION_INBOX_PREFS)
})

test('prefs: stored opt-outs apply only to mutable categories', () => {
  const prefs = readNotificationInboxPrefs({
    inapp: { order: false, service_request: false, billing: false, system: false },
  })
  assert.equal(prefs.order, false)
  assert.equal(prefs.service_request, false)
  // Unmutable categories cannot be stored off.
  assert.equal(prefs.billing, true)
  assert.equal(prefs.system, true)
})

test('in-app delivery decision: critical always lands, prefs gate the rest', () => {
  const muted = readNotificationInboxPrefs({ inapp: { order: false } })
  assert.equal(shouldDeliverInApp('order', 'info', muted), false)
  assert.equal(shouldDeliverInApp('order', 'critical', muted), true)
  assert.equal(shouldDeliverInApp('billing', 'info', muted), true)
  const open = readNotificationInboxPrefs(null)
  assert.equal(shouldDeliverInApp('order', 'info', open), true)
})
