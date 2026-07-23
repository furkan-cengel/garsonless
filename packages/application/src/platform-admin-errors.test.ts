import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { err, ok } from '@garsonless/domain/result'
import {
  readPlatformErrorOverview,
  type PlatformErrorOverview,
  type PlatformErrorReadPort,
} from './platform-admin-errors'

const overview: PlatformErrorOverview = {
  eventCount: 0,
  fingerprintCount: 0,
  criticalFingerprintCount: 0,
  affectedTenantCount: 0,
  items: [],
}
const actor = (role: PlatformAdminActorContext['role']): PlatformAdminActorContext => ({
  actor: 'platform-admin',
  userId: '11111111-1111-4111-8111-111111111111',
  role,
  aal: 'aal2',
})

test('all AAL2 platform roles can read global error health', async () => {
  const port: PlatformErrorReadPort = { readOverview: async () => ok(overview) }
  for (const role of ['support', 'ops', 'finance', 'superadmin'] as const) {
    assert.deepEqual(await readPlatformErrorOverview(actor(role), {}, port), { ok: true, value: overview })
  }
})

test('closed filters normalize before crossing the read port', async () => {
  let received: unknown
  const port: PlatformErrorReadPort = {
    readOverview: async (input) => {
      received = input
      return ok(overview)
    },
  }
  await readPlatformErrorOverview(actor('support'), {
    window: '7d',
    app: 'worker',
    severity: 'critical',
    limit: 25,
  }, port)
  assert.deepEqual(received, { window: '7d', app: 'worker', severity: 'critical', limit: 25 })
})

test('invalid filters and missing AAL2 fail before the database', async () => {
  let calls = 0
  const port: PlatformErrorReadPort = {
    readOverview: async () => {
      calls += 1
      return ok(overview)
    },
  }
  assert.deepEqual(await readPlatformErrorOverview(actor('ops'), {
    window: 'forever' as never,
  }, port), { ok: false, error: 'Invalid error query' })
  assert.deepEqual(await readPlatformErrorOverview(actor('ops'), {
    limit: 10,
  }, port), { ok: false, error: 'Invalid error query' })
  assert.deepEqual(await readPlatformErrorOverview({
    ...actor('superadmin'),
    aal: 'aal1',
  } as unknown as PlatformAdminActorContext, {}, port), { ok: false, error: 'Not authorized' })
  assert.equal(calls, 0)
})

test('infrastructure details collapse into a stable application error', async () => {
  const port: PlatformErrorReadPort = { readOverview: async () => err('secret SQL') }
  assert.deepEqual(await readPlatformErrorOverview(actor('support'), {}, port), {
    ok: false,
    error: 'Error overview could not be loaded',
  })
})
