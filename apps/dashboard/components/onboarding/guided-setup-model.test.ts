import assert from 'node:assert/strict'
import test from 'node:test'
import { availableSetupTours, parseGuideProgress } from './guided-setup-model'

test('tour resumption rejects corrupt, future or out-of-range local storage', () => {
  for (const value of [null, {}, { tour: 'unknown', step: 0 }, { tour: 'menu', step: -1 }, { tour: 'menu', step: 3 }, { tour: 'menu', step: 0.5 }]) assert.equal(parseGuideProgress(value), null)
  assert.deepEqual(parseGuideProgress({ tour: 'menu', step: 2 }), { tour: 'menu', step: 2 })
})
test('tours honor section permissions, entitlements and owner-only logo editing', () => {
  assert.deepEqual(availableSetupTours(['menu', 'settings'], {}, false).map(t => t.id), ['menu'])
  assert.deepEqual(availableSetupTours([], { theme: { allowed: false } }, true).map(t => t.id), ['menu', 'logo'])
  assert.deepEqual(availableSetupTours([], {}, false), [])
})
