import assert from 'node:assert/strict'
import test from 'node:test'
import { orderStatusPhase } from './orderStatusPhase'

test('dashboard transitions advance the customer order tracker', () => {
  assert.equal(orderStatusPhase('pending_approval'), 0)
  assert.equal(orderStatusPhase('sent_to_kitchen'), 1)
  assert.equal(orderStatusPhase('ready'), 2)
  assert.equal(orderStatusPhase('served'), 3)
})

test('legacy preparation and paid statuses do not move the tracker backwards', () => {
  assert.equal(orderStatusPhase('pending'), 0)
  assert.equal(orderStatusPhase('preparing'), 1)
  assert.equal(orderStatusPhase('paid'), 1)
})

