import assert from 'node:assert/strict'
import test from 'node:test'
import { kitchenSessionTestKit } from './kitchen-session'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const secret = 'credential-secret'
const now = 1_800_000_000

test('kitchen artifacts are tenant- and purpose-bound', () => {
  const launch = kitchenSessionTestKit.signArtifact('launch', restaurantId, secret, 45, now)
  assert.equal(kitchenSessionTestKit.verifyArtifact(launch, 'launch', restaurantId, secret, now), true)
  assert.equal(kitchenSessionTestKit.verifyArtifact(launch, 'session', restaurantId, secret, now), false)
  assert.equal(kitchenSessionTestKit.verifyArtifact(launch, 'launch', '22222222-2222-4222-8222-222222222222', secret, now), false)
})

test('kitchen artifacts reject tampering, expiry and credential rotation', () => {
  const session = kitchenSessionTestKit.signArtifact('session', restaurantId, secret, 60, now)
  assert.equal(kitchenSessionTestKit.verifyArtifact(`${session}x`, 'session', restaurantId, secret, now), false)
  assert.equal(kitchenSessionTestKit.verifyArtifact(session, 'session', restaurantId, 'rotated-secret', now), false)
  assert.equal(kitchenSessionTestKit.verifyArtifact(session, 'session', restaurantId, secret, now + 60), false)
})

test('kitchen receipt hashes are deterministic and do not reveal the artifact', () => {
  const launch = kitchenSessionTestKit.signArtifact('launch', restaurantId, secret, 45, now)
  const hash = kitchenSessionTestKit.hashArtifact(launch)
  assert.equal(hash.length, 64)
  assert.equal(hash, kitchenSessionTestKit.hashArtifact(launch))
  assert.equal(hash.includes(launch), false)
})
