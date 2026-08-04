import assert from 'node:assert/strict'
import test from 'node:test'
import { fingerprintThemePublish } from './theme-publish-fingerprint'

const intent = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  templateId: 'default',
  tokens: { accent: '#123456', nested: { enabled: true, count: 2 } },
  publishedBy: '22222222-2222-4222-8222-222222222222',
  expectedRevision: 3,
}

test('theme publish fingerprint is stable across object key order', () => {
  const reordered = {
    publishedBy: intent.publishedBy,
    tokens: { nested: { count: 2, enabled: true }, accent: '#123456' },
    expectedRevision: 3,
    templateId: 'default',
    restaurantId: intent.restaurantId,
  }
  assert.equal(fingerprintThemePublish(intent), fingerprintThemePublish(reordered))
  assert.match(fingerprintThemePublish(intent), /^[a-f0-9]{64}$/)
})

test('theme publish fingerprint changes for every immutable intent boundary', () => {
  assert.notEqual(fingerprintThemePublish(intent), fingerprintThemePublish({ ...intent, expectedRevision: 4 }))
  assert.notEqual(fingerprintThemePublish(intent), fingerprintThemePublish({ ...intent, tokens: { accent: '#abcdef' } }))
  assert.notEqual(fingerprintThemePublish(intent), fingerprintThemePublish({ ...intent, publishedBy: '33333333-3333-4333-8333-333333333333' }))
  assert.notEqual(fingerprintThemePublish(intent), fingerprintThemePublish({ ...intent, restaurantId: '44444444-4444-4444-8444-444444444444' }))
})
