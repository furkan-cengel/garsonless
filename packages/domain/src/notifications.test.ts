import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  DEFAULT_NOTIFICATION_INBOX_PREFS,
  isMutableNotification,
  notificationDedupeKey,
  readNotificationChannelPrefs,
  readNotificationInboxPrefs,
  shouldDeliverInApp,
  shouldDeliverOnChannel,
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

test('email channel defaults are opt-in for mutable, always-on for unmutable', () => {
  const defaults = readNotificationChannelPrefs(null, 'email')
  assert.equal(defaults.order, false)
  assert.equal(defaults.service_request, false)
  assert.equal(defaults.billing, true)
  assert.equal(defaults.system, true)
})

test('email opt-in applies per category; unmutable cannot be stored off', () => {
  const prefs = readNotificationChannelPrefs({
    email: { order: true, billing: false },
    inapp: { order: false },
  }, 'email')
  assert.equal(prefs.order, true)
  assert.equal(prefs.service_request, false)
  assert.equal(prefs.billing, true)
  assert.equal(shouldDeliverOnChannel('order', 'info', prefs), true)
  assert.equal(shouldDeliverOnChannel('service_request', 'info', prefs), false)
  assert.equal(shouldDeliverOnChannel('billing', 'info', prefs), true)
})

test('channel prefs are isolated: inapp opt-out does not mute email and vice versa', () => {
  const raw = { inapp: { order: false }, email: { order: true } }
  assert.equal(readNotificationChannelPrefs(raw, 'inapp').order, false)
  assert.equal(readNotificationChannelPrefs(raw, 'email').order, true)
})

test('in-app delivery decision: critical always lands, prefs gate the rest', () => {
  const muted = readNotificationInboxPrefs({ inapp: { order: false } })
  assert.equal(shouldDeliverInApp('order', 'info', muted), false)
  assert.equal(shouldDeliverInApp('order', 'critical', muted), true)
  assert.equal(shouldDeliverInApp('billing', 'info', muted), true)
  const open = readNotificationInboxPrefs(null)
  assert.equal(shouldDeliverInApp('order', 'info', open), true)
})
