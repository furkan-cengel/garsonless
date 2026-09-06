import assert from 'node:assert/strict'
import test from 'node:test'
import {
  finalizeIyzicoOrderRefund,
  recordManualOrderRefund,
  reserveIyzicoOrderRefund,
  type OrderRefundPort,
  type OrderRefundResult,
} from './refunds'

const row: OrderRefundResult = {
  id: 'refund', orderId: 'order', restaurantId: 'r', method: 'cash', source: 'manual',
  status: 'succeeded', kind: 'partial', amount: 10, idempotencyKey: 'request',
  providerPaymentId: null, providerRefundRef: null, refundedAt: 'now',
  replayed: false,
}

function port(calls: string[]): OrderRefundPort {
  return {
    async recordManual() { calls.push('manual'); return { ok: true, value: row } },
    async reserveIyzico() { calls.push('reserve'); return { ok: true, value: { ...row, method: 'iyzico', source: 'provider', status: 'pending' } } },
    async finalizeIyzico() { calls.push('finalize'); return { ok: true, value: { ...row, method: 'iyzico', source: 'provider' } } },
    async markIyzicoUnsuccessful() { calls.push('fail'); return { ok: true, value: true } },
  }
}

test('manual, reservation and provider finalization agree on cent precision', async () => {
  const owner = { actor: 'dashboard-member', restaurantId: 'r', userId: 'u', permissions: ['orders'], isOwner: true } as const
  for (const amount of [0.29, 1.1, 19.99, 19.999, 0, -1]) {
    const calls: string[] = []
    const repository = port(calls)
    const input = { orderId: 'o', restaurantId: 'r', amount, reason: 'Müşteri talebi', idempotencyKey: 'request' }
    const expected = amount > 0 && amount !== 19.999
    assert.equal((await recordManualOrderRefund(owner, { ...input, method: 'cash' }, repository)).ok, expected)
    assert.equal((await reserveIyzicoOrderRefund(owner, input, repository)).ok, expected)
    assert.equal((await finalizeIyzicoOrderRefund(
      { actor: 'payment-provider', restaurantId: 'r', provider: 'iyzico' },
      { ...input, refundId: 'refund', providerPaymentId: 'p', providerRefundRef: 'h' }, repository,
    )).ok, expected)
    assert.equal(calls.length, expected ? 3 : 0)
  }
})

test('manual refund is owner-only, tenant-bound and cash/POS only', async () => {
  const calls: string[] = []
  const repository = port(calls)
  const member = { actor: 'dashboard-member', restaurantId: 'r', userId: 'u', permissions: ['orders'] } as const
  const owner = { ...member, isOwner: true } as const

  assert.deepEqual(await recordManualOrderRefund(member, {
    orderId: 'o', restaurantId: 'r', method: 'cash', amount: 10, reason: 'Müşteri talebi', idempotencyKey: 'x',
  }, repository), { ok: false, error: 'Not authorized' })
  assert.deepEqual(await recordManualOrderRefund(owner, {
    orderId: 'o', restaurantId: 'other', method: 'cash', amount: 10, reason: 'Müşteri talebi', idempotencyKey: 'x',
  }, repository), { ok: false, error: 'Not authorized' })
  assert.equal(calls.length, 0)

  const result = await recordManualOrderRefund(owner, {
    orderId: 'o', restaurantId: 'r', method: 'pos', amount: 10.25, reason: ' Müşteri talebi ', idempotencyKey: ' request ',
  }, repository)
  assert.equal(result.ok, true)
  assert.deepEqual(calls, ['manual'])
})

test('owner can reserve iyzico but only provider context can finalize it', async () => {
  const calls: string[] = []
  const repository = port(calls)
  const owner = { actor: 'dashboard-member', restaurantId: 'r', userId: 'u', permissions: ['orders'], isOwner: true } as const
  assert.equal((await reserveIyzicoOrderRefund(owner, {
    orderId: 'o', restaurantId: 'r', amount: 5, reason: 'Kısmi iade', idempotencyKey: 'request',
  }, repository)).ok, true)

  const wrongTenant = await finalizeIyzicoOrderRefund(
    { actor: 'payment-provider', restaurantId: 'other', provider: 'iyzico' },
    { refundId: 'refund', orderId: 'o', restaurantId: 'r', amount: 5, providerPaymentId: 'p', providerRefundRef: 'h', idempotencyKey: 'request' },
    repository,
  )
  assert.deepEqual(wrongTenant, { ok: false, error: 'Not authorized' })
  assert.deepEqual(calls, ['reserve'])

  assert.equal((await finalizeIyzicoOrderRefund(
    { actor: 'payment-provider', restaurantId: 'r', provider: 'iyzico' },
    { refundId: 'refund', orderId: 'o', restaurantId: 'r', amount: 5, providerPaymentId: 'p', providerRefundRef: 'h', idempotencyKey: 'request' },
    repository,
  )).ok, true)
  assert.deepEqual(calls, ['reserve', 'finalize'])
})
