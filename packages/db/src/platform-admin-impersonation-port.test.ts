import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlatformAdminImpersonationPort, type PlatformImpersonationRpc } from './platform-admin-impersonation-port'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const REQUEST_ID = '44444444-4444-4444-8444-444444444444'

const session = {
  id: SESSION_ID,
  restaurantId: TENANT_ID,
  actorUserId: USER_ID,
  actorRole: 'support',
  reason: 'Müşteri destek talebi için güvenli inceleme.',
  startedAt: '2026-07-22T10:00:00.000Z',
  expiresAt: '2026-07-22T10:30:00.000Z',
  endedAt: null,
  status: 'active',
}

test('impersonation adapter maps trusted actor arguments and parses a closed projection', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc: PlatformImpersonationRpc = async (name, args) => {
    calls.push({ name, args })
    return name === 'read_platform_admin_impersonation_session'
      ? { data: session, error: null }
      : { data: { session, duplicate: false, requestId: REQUEST_ID }, error: null }
  }
  const port = createPlatformAdminImpersonationPort(rpc)
  assert.equal((await port.readSession({ sessionId: SESSION_ID, actorUserId: USER_ID, actorRole: 'support' })).ok, true)
  assert.equal((await port.startSession({
    restaurantId: TENANT_ID,
    actorUserId: USER_ID,
    actorRole: 'support',
    durationMinutes: 30,
    reason: session.reason,
    requestId: REQUEST_ID,
  })).ok, true)
  assert.equal((await port.endSession({
    sessionId: SESSION_ID,
    actorUserId: USER_ID,
    actorRole: 'support',
    reason: 'Destek incelemesi güvenli biçimde tamamlandı.',
    requestId: REQUEST_ID,
  })).ok, true)
  assert.deepEqual(calls.map((call) => call.name), [
    'read_platform_admin_impersonation_session',
    'start_platform_admin_impersonation_session',
    'end_platform_admin_impersonation_session',
  ])
  assert.equal(calls[1]?.args.p_actor_role, 'support')
  assert.equal(calls[1]?.args.p_duration_minutes, 30)
})

test('malformed projections and raw database errors fail closed', async () => {
  const malformed = createPlatformAdminImpersonationPort(async () => ({
    data: { ...session, actorRole: 'finance' },
    error: null,
  }))
  const failed = createPlatformAdminImpersonationPort(async () => ({
    data: null,
    error: { message: 'sensitive database detail' },
  }))
  assert.equal((await malformed.readSession({ sessionId: SESSION_ID, actorUserId: USER_ID, actorRole: 'support' })).ok, false)
  assert.equal((await failed.startSession({
    restaurantId: TENANT_ID,
    actorUserId: USER_ID,
    actorRole: 'support',
    durationMinutes: 15,
    reason: session.reason,
    requestId: REQUEST_ID,
  })).ok, false)
})
