import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_NOTIFICATION_PREFS, readNotificationPrefs } from '../../lib/notification-prefs'

test('legacy restaurants receive backward-compatible order alarm defaults', () => {
  assert.deepEqual(readNotificationPrefs({}), DEFAULT_NOTIFICATION_PREFS)
})

test('order alarm settings validate presets, intervals and numeric bounds', () => {
  const prefs = readNotificationPrefs({
    notifications: {
      newOrderSoundPreset: 'not-a-preset',
      newOrderSoundVolume: 240,
      newOrderRepeatSeconds: 12,
      newOrderRepeatMaxMinutes: -4,
    },
  })

  assert.equal(prefs.newOrderSoundPreset, 'classic')
  assert.equal(prefs.newOrderSoundVolume, 100)
  assert.equal(prefs.newOrderRepeatSeconds, 0)
  assert.equal(prefs.newOrderRepeatMaxMinutes, 1)
})

test('supported order alarm settings are preserved', () => {
  const prefs = readNotificationPrefs({
    notifications: {
      newOrderSound: false,
      newOrderSoundPreset: 'double-chime',
      newOrderSoundVolume: 35,
      newOrderRepeatSeconds: 30,
      newOrderRepeatMaxMinutes: 10,
    },
  })

  assert.equal(prefs.newOrderSound, false)
  assert.equal(prefs.newOrderSoundPreset, 'double-chime')
  assert.equal(prefs.newOrderSoundVolume, 35)
  assert.equal(prefs.newOrderRepeatSeconds, 30)
  assert.equal(prefs.newOrderRepeatMaxMinutes, 10)
})
