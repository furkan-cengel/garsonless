import assert from 'node:assert/strict'
import test from 'node:test'

import { getMenuSaveState } from './menu-save-state-model'

test('saving takes priority over dirty and saved feedback', () => {
  assert.equal(getMenuSaveState({ dirty: true, saving: true, recentlySaved: true }), 'saving')
})

test('dirty takes priority once persistence is idle', () => {
  assert.equal(getMenuSaveState({ dirty: true, saving: false, recentlySaved: true }), 'dirty')
})

test('saved feedback is temporary and clean is the stable idle state', () => {
  assert.equal(getMenuSaveState({ dirty: false, saving: false, recentlySaved: true }), 'saved')
  assert.equal(getMenuSaveState({ dirty: false, saving: false, recentlySaved: false }), 'clean')
})
