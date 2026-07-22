import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlatformAdminTenantBillingReadPort,
  type PlatformTenantBillingRpc,
} from './platform-admin-billing-port'

const restaurantId = '11111111-1111-4111-8111-111111111111'
const actorUserId = '22222222-2222-4222-8222-222222222222'
const invoiceId = '33333333-3333-4333-8333-333333333333'
const itemId = '44444444-4444-4444-8444-444444444444'

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
