import assert from 'node:assert/strict'
import test from 'node:test'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { ok } from '@garsonless/domain/result'
import {
  intervenePlatformBillingDunning,
  readPlatformTenantBillingTimeline,
  type PlatformDunningInterventionPort,
  type PlatformTenantBillingReadPort,
} from './platform-admin-billing'

const actor: PlatformAdminActorContext = {
  actor: 'platform-admin',
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'superadmin',
  aal: 'aal2',
}
const restaurantId = '11111111-1111-4111-8111-111111111111'
const invoiceId = '44444444-4444-4444-8444-444444444444'
const runId = '55555555-5555-4555-8555-555555555555'
const requestId = '66666666-6666-4666-8666-666666666666'
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

test('dunning intervention is finance/superadmin-only before persistence', async () => {
  let calls = 0
  const port: PlatformDunningInterventionPort = {
    async intervene() {
      calls += 1
      return ok({
        restaurantId, invoiceId, runId, intervention: 'retry_now',
        previousStatus: 'failed', status: 'scheduled',
        previousNextActionAt: '2026-07-23T12:00:00.000Z',
        nextActionAt: '2026-07-22T12:00:00.000Z', changed: true,
        duplicate: false, requestId,
      })
    },
  }
  const input = {
    restaurantId, invoiceId, intervention: 'retry_now' as const,
    reason: 'Tahsilat yeniden sıraya alınacak', requestId,
  }
  for (const role of ['support', 'ops'] as const) {
    assert.deepEqual(await intervenePlatformBillingDunning({ ...actor, role }, input, port), {
      ok: false,
      error: 'Not authorized',
    })
  }
  assert.equal(calls, 0)
  assert.equal((await intervenePlatformBillingDunning({ ...actor, role: 'finance' }, input, port)).ok, true)
  assert.equal((await intervenePlatformBillingDunning(actor, input, port)).ok, true)
  assert.equal(calls, 2)
})

test('dunning intervention validates input and derives trusted actor fields', async () => {
  let received: unknown
  const port: PlatformDunningInterventionPort = {
    async intervene(input) {
      received = input
      return ok({
        restaurantId, invoiceId, runId, intervention: 'defer',
        previousStatus: 'scheduled', status: 'scheduled',
        previousNextActionAt: '2026-07-23T12:00:00.000Z',
        nextActionAt: '2026-07-29T12:00:00.000Z', changed: true,
        duplicate: false, requestId,
      })
    },
  }
  const result = await intervenePlatformBillingDunning({ ...actor, role: 'finance' }, {
    restaurantId, invoiceId, intervention: 'defer', deferDays: 7,
    reason: '  Müşteriye yedi günlük kontrollü ek süre verildi  ', requestId,
  }, port)
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    restaurantId,
    invoiceId,
    actorUserId: actor.userId,
    actorRole: 'finance',
    intervention: 'defer',
    deferDays: 7,
    reason: 'Müşteriye yedi günlük kontrollü ek süre verildi',
    requestId,
  })

  for (const input of [
    { restaurantId: 'forged', invoiceId, intervention: 'retry_now' as const, reason: 'Geçerli işlem gerekçesi', requestId },
    { restaurantId, invoiceId: 'forged', intervention: 'retry_now' as const, reason: 'Geçerli işlem gerekçesi', requestId },
    { restaurantId, invoiceId, intervention: 'defer' as const, deferDays: 0, reason: 'Geçerli işlem gerekçesi', requestId },
    { restaurantId, invoiceId, intervention: 'defer' as const, deferDays: 31, reason: 'Geçerli işlem gerekçesi', requestId },
    { restaurantId, invoiceId, intervention: 'retry_now' as const, reason: 'kısa', requestId },
    { restaurantId, invoiceId, intervention: 'retry_now' as const, reason: 'Geçerli işlem gerekçesi', requestId: 'forged' },
  ]) {
    assert.equal((await intervenePlatformBillingDunning(actor, input, port)).ok, false)
  }
})

test('dunning intervention preserves safe conflicts and collapses database details', async () => {
  const base = {
    restaurantId, invoiceId, intervention: 'retry_now' as const,
    reason: 'Tahsilat yeniden sıraya alınacak', requestId,
  }
  for (const [portError, expected] of [
    ['platform_dunning_run_busy', 'Dunning run is currently being processed'],
    ['platform_dunning_not_actionable', 'Dunning run is not actionable'],
    ['provider secret and raw SQL detail', 'Dunning intervention could not be applied'],
  ] as const) {
    const port: PlatformDunningInterventionPort = { async intervene() { return { ok: false, error: portError } } }
    assert.deepEqual(await intervenePlatformBillingDunning(actor, base, port), { ok: false, error: expected })
  }
})
