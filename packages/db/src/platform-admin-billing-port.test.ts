import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlatformAdminDunningInterventionPort,
  createPlatformAdminTenantBillingReadPort,
  type PlatformTenantBillingRpc,
} from './platform-admin-billing-port'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const actorUserId = '22222222-2222-4222-8222-222222222222'
const invoiceId = '33333333-3333-4333-8333-333333333333'
const itemId = '44444444-4444-4444-8444-444444444444'
const runId = '55555555-5555-4555-8555-555555555555'
const requestId = '66666666-6666-4666-8666-666666666666'

const projection = {
  summary: {
    outstandingMinor: 14990,
    currency: 'TRY',
    openInvoices: 1,
    activeDunning: 1,
    openReconciliation: 0,
    failedAttempts: 1,
  },
  items: [{
    id: itemId,
    kind: 'payment_attempt',
    status: 'failed',
    action: 'payment.attempt',
    occurredAt: '2026-07-22T12:00:00.000Z',
    invoiceId,
    amountMinor: 14990,
    currency: 'TRY',
    attempt: 1,
    nextActionAt: null,
    completedAt: '2026-07-22T12:01:00.000Z',
    hasError: true,
  }],
}

test('billing timeline port maps trusted actor scope and parses safe projection', async () => {
  let received: unknown
  const rpc: PlatformTenantBillingRpc = async (name, args) => {
    received = { name, args }
    return { data: projection, error: null }
  }
  const result = await createPlatformAdminTenantBillingReadPort(rpc).readTimeline({
    restaurantId,
    actorUserId,
    actorRole: 'finance',
    limit: 50,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    name: 'read_platform_admin_tenant_billing_timeline',
    args: {
      p_restaurant_id: restaurantId,
      p_actor_user_id: actorUserId,
      p_actor_role: 'finance',
      p_limit: 50,
    },
  })
})

test('billing timeline parser rejects open vocabulary and malformed money', async () => {
  for (const data of [
    { ...projection, items: [{ ...projection.items[0], status: 'invented' }] },
    { ...projection, items: [{ ...projection.items[0], action: 'provider.secret' }] },
    { ...projection, summary: { ...projection.summary, outstandingMinor: 14.99 } },
    { ...projection, items: [{ ...projection.items[0], currency: 'USD' }] },
  ]) {
    const rpc: PlatformTenantBillingRpc = async () => ({ data, error: null })
    assert.deepEqual(await createPlatformAdminTenantBillingReadPort(rpc).readTimeline({
      restaurantId,
      actorUserId,
      actorRole: 'superadmin',
      limit: 50,
    }), { ok: false, error: 'platform_billing_timeline_query_failed' })
  }
})

test('billing database details remain behind a stable port error', async () => {
  const rpc: PlatformTenantBillingRpc = async () => ({
    data: null,
    error: { message: 'provider reference and PII details' },
  })
  assert.deepEqual(await createPlatformAdminTenantBillingReadPort(rpc).readTimeline({
    restaurantId,
    actorUserId,
    actorRole: 'finance',
    limit: 25,
  }), { ok: false, error: 'platform_billing_timeline_query_failed' })
})

test('dunning intervention port maps trusted fields and parses a closed result', async () => {
  let received: unknown
  const rpc: PlatformTenantBillingRpc = async (name, args) => {
    received = { name, args }
    return {
      data: {
        restaurantId, invoiceId, runId, intervention: 'defer',
        previousStatus: 'failed', status: 'scheduled',
        previousNextActionAt: '2026-07-22T12:00:00.000Z',
        nextActionAt: '2026-07-29T12:00:00.000Z', changed: true,
        duplicate: false, requestId,
      },
      error: null,
    }
  }
  const result = await createPlatformAdminDunningInterventionPort(rpc).intervene({
    restaurantId, invoiceId, actorUserId, actorRole: 'finance',
    intervention: 'defer', deferDays: 7,
    reason: 'Müşteriye kontrollü ek süre verildi', requestId,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(received, {
    name: 'intervene_platform_admin_billing_dunning',
    args: {
      p_restaurant_id: restaurantId,
      p_invoice_id: invoiceId,
      p_actor_user_id: actorUserId,
      p_actor_role: 'finance',
      p_intervention: 'defer',
      p_defer_days: 7,
      p_reason: 'Müşteriye kontrollü ek süre verildi',
      p_request_id: requestId,
    },
  })
})

test('dunning intervention port preserves safe conflicts and rejects malformed projection', async () => {
  const input = {
    restaurantId, invoiceId, actorUserId, actorRole: 'superadmin' as const,
    intervention: 'retry_now' as const, deferDays: null,
    reason: 'Tahsilat güvenli biçimde sıraya alındı', requestId,
  }
  for (const [message, expected] of [
    ['platform_dunning_run_busy', 'platform_dunning_run_busy'],
    ['platform_dunning_not_actionable', 'platform_dunning_not_actionable'],
    ['provider secret and SQL detail', 'platform_dunning_intervention_failed'],
  ] as const) {
    const rpc: PlatformTenantBillingRpc = async () => ({ data: null, error: { message } })
    assert.deepEqual(await createPlatformAdminDunningInterventionPort(rpc).intervene(input), { ok: false, error: expected })
  }

  const malformed: PlatformTenantBillingRpc = async () => ({
    data: {
      restaurantId, invoiceId, runId, intervention: 'mark_paid',
      previousStatus: 'failed', status: 'paid', previousNextActionAt: null,
      nextActionAt: 'not-a-date', changed: true, duplicate: false, requestId,
    },
    error: null,
  })
  assert.deepEqual(await createPlatformAdminDunningInterventionPort(malformed).intervene(input), {
    ok: false,
    error: 'platform_dunning_intervention_failed',
  })
})
