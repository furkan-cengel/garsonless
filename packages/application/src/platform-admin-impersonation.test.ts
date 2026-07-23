import assert from 'node:assert/strict'
import test from 'node:test'
import { ok, type Result } from '@garsonless/domain/result'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import {
  endPlatformImpersonationSession,
  readPlatformImpersonationSession,
  startPlatformImpersonationSession,
  type PlatformImpersonationMutationResult,
  type PlatformImpersonationPort,
  type PlatformImpersonationSession,
} from './platform-admin-impersonation'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const REQUEST_ID = '44444444-4444-4444-8444-444444444444'

function actor(role: PlatformAdminActorContext['role']): PlatformAdminActorContext {
  return { actor: 'platform-admin', userId: USER_ID, role, aal: 'aal2' }
}

const session: PlatformImpersonationSession = {
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

function port(overrides: Partial<PlatformImpersonationPort> = {}): PlatformImpersonationPort {
  const mutation: PlatformImpersonationMutationResult = {
    session,
    duplicate: false,
    requestId: REQUEST_ID,
  }
  return {
    readSession: async () => ok(session),
    startSession: async () => ok(mutation),
    endSession: async () => ok(mutation),
    ...overrides,
  }
}

test('support, ops and superadmin may start a bounded read-only session', async () => {
  for (const role of ['support', 'ops', 'superadmin'] as const) {
    let called = 0
    const result = await startPlatformImpersonationSession(actor(role), {
      restaurantId: TENANT_ID,
      durationMinutes: 30,
      reason: 'Müşteri destek talebi için güvenli inceleme.',
      requestId: REQUEST_ID,
    }, port({ startSession: async (input) => {
      called += 1
      assert.equal(input.actorRole, role)
      assert.equal(input.durationMinutes, 30)
      return ok({ session: { ...session, actorRole: role }, duplicate: false, requestId: REQUEST_ID })
    } }))
    assert.equal(result.ok, true)
    assert.equal(called, 1)
  }
})

test('finance and invalid inputs fail before persistence', async () => {
  let calls = 0
  const blockedPort = port({ startSession: async () => {
    calls += 1
    return ok({ session, duplicate: false, requestId: REQUEST_ID })
  } })
  const denied = await startPlatformImpersonationSession(actor('finance'), {
    restaurantId: TENANT_ID,
    durationMinutes: 30,
    reason: 'Müşteri destek talebi için güvenli inceleme.',
    requestId: REQUEST_ID,
  }, blockedPort)
  const invalidDuration = await startPlatformImpersonationSession(actor('support'), {
    restaurantId: TENANT_ID,
    durationMinutes: 120 as 60,
    reason: 'Müşteri destek talebi için güvenli inceleme.',
    requestId: REQUEST_ID,
  }, blockedPort)
  assert.deepEqual(denied, { ok: false, error: 'Not authorized' })
  assert.deepEqual(invalidDuration, { ok: false, error: 'Invalid duration' })
  assert.equal(calls, 0)
})

test('read and end remain bound to the verified actor', async () => {
  let readInput: unknown
  let endInput: unknown
  const adapter = port({
    readSession: async (input) => {
      readInput = input
      return ok(session)
    },
    endSession: async (input) => {
      endInput = input
      return ok({ session: { ...session, endedAt: '2026-07-22T10:10:00.000Z', status: 'ended' }, duplicate: false, requestId: REQUEST_ID })
    },
  })
  assert.equal((await readPlatformImpersonationSession(actor('support'), SESSION_ID, adapter)).ok, true)
  assert.equal((await endPlatformImpersonationSession(actor('support'), {
    sessionId: SESSION_ID,
    reason: 'Destek incelemesi kullanıcı isteğiyle tamamlandı.',
    requestId: REQUEST_ID,
  }, adapter)).ok, true)
  assert.deepEqual(readInput, { sessionId: SESSION_ID, actorUserId: USER_ID, actorRole: 'support' })
  assert.deepEqual(endInput, {
    sessionId: SESSION_ID,
    actorUserId: USER_ID,
    actorRole: 'support',
    reason: 'Destek incelemesi kullanıcı isteğiyle tamamlandı.',
    requestId: REQUEST_ID,
  })
})

test('port failures stay behind a stable boundary error', async () => {
  const failed = port({
    readSession: async () => ({ ok: false, error: 'database detail' } as Result<never>),
  })
  assert.deepEqual(
    await readPlatformImpersonationSession(actor('support'), SESSION_ID, failed),
    { ok: false, error: 'Impersonation session could not be loaded' },
  )
})
