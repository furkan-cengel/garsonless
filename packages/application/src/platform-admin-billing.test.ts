import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { ok } from '@garsonless/domain/result'
import {
  readPlatformTenantBillingTimeline,
  type PlatformTenantBillingReadPort,
} from './platform-admin-billing'

const actor: PlatformAdminActorContext = {
  actor: 'platform-admin',
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'superadmin',
  aal: 'aal2',
}
const restaurantId = '11111111-1111-4111-8111-111111111111'
const emptyTimeline = {
  summary: {
    outstandingMinor: 0,
    currency: 'TRY' as const,
    openInvoices: 0,
    activeDunning: 0,
    openReconciliation: 0,
    failedAttempts: 0,
  },
  items: [],
}

test('billing timeline is finance/superadmin-only before persistence', async () => {
  let calls = 0
  const port: PlatformTenantBillingReadPort = {
    async readTimeline() {
      calls += 1
      return ok(emptyTimeline)
    },
  }
  for (const role of ['support', 'ops'] as const) {
    assert.deepEqual(await readPlatformTenantBillingTimeline({ ...actor, role }, restaurantId, port), {
      ok: false,
      error: 'Not authorized',
    })
  }
  assert.equal(calls, 0)
  assert.equal((await readPlatformTenantBillingTimeline({ ...actor, role: 'finance' }, restaurantId, port)).ok, true)
  assert.equal((await readPlatformTenantBillingTimeline(actor, restaurantId, port)).ok, true)
  assert.equal(calls, 2)
})

test('billing timeline derives actor fields and bounded limit', async () => {
  let received: unknown
  const port: PlatformTenantBillingReadPort = {
    async readTimeline(input) {
      received = input
      return ok(emptyTimeline)
    },
  }
  const result = await readPlatformTenantBillingTimeline({ ...actor, role: 'finance' }, restaurantId, port, 25)
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    restaurantId,
    actorUserId: actor.userId,
    actorRole: 'finance',
    limit: 25,
  })
})

test('invalid tenant and limit fail before the read port', async () => {
  let calls = 0
  const port: PlatformTenantBillingReadPort = {
    async readTimeline() {
      calls += 1
      return ok(emptyTimeline)
    },
  }
  assert.deepEqual(await readPlatformTenantBillingTimeline(actor, 'forged', port), { ok: false, error: 'Invalid tenant id' })
  assert.deepEqual(await readPlatformTenantBillingTimeline(actor, restaurantId, port, 0), { ok: false, error: 'Invalid timeline limit' })
  assert.deepEqual(await readPlatformTenantBillingTimeline(actor, restaurantId, port, 101), { ok: false, error: 'Invalid timeline limit' })
  assert.equal(calls, 0)
})

test('database details collapse into a stable billing timeline error', async () => {
  const port: PlatformTenantBillingReadPort = {
    async readTimeline() {
      return { ok: false, error: 'provider secret and raw SQL detail' }
    },
  }
  assert.deepEqual(await readPlatformTenantBillingTimeline(actor, restaurantId, port), {
    ok: false,
    error: 'Billing timeline could not be loaded',
  })
})
