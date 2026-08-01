import assert from 'node:assert/strict'
import test from 'node:test'
import { transferActorLabel } from './table-transfer-actor-label'

test('history actor owned by the viewer uses the concise self label', () => {
  assert.equal(transferActorLabel('viewer-a', 'viewer-a'), 'Siz')
})

test('history actor outside the viewer stays identifiable without exposing PII', () => {
  assert.equal(transferActorLabel('actor-b', 'viewer-a'), 'Başka bir yetkili')
})
