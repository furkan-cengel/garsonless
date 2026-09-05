import assert from 'node:assert/strict'
import test from 'node:test'
import { ok } from '@garsonless/domain/result'
import {
  requestPlatformSubscriptionRefund,
  type PlatformSubscriptionRefundPort,
  type SubscriptionRefundProvider,
} from './platform-admin-subscription-refunds'

const actor = {
  actor: 'platform-admin' as const,
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'finance' as const,
  aal: 'aal2' as const,
}
const input = {
  restaurantId: '00000000-0000-4000-8000-000000000002',
  invoiceId: '00000000-0000-4000-8000-000000000003',
  kind: 'refund' as const,
  accessAction: 'keep' as const,
  amountMinor: 10_000,
  reasonCode: 'customer_request' as const,
  reasonDetail: 'Müşteri talebi doğrulandı.',
  requestId: '00000000-0000-4000-8000-000000000004',
  idempotencyKey: 'subscription-refund:00000000-0000-4000-8000-000000000004',
  requestFingerprint: 'a'.repeat(64),
  occurredAt: '2026-09-01T12:00:00.000Z',
}
const preparation = {
  refundId: '00000000-0000-4000-8000-000000000005',
  operationId: '00000000-0000-4000-8000-000000000006',
  restaurantId: input.restaurantId,
  subscriptionId: '00000000-0000-4000-8000-000000000007',
  invoiceId: input.invoiceId,
  providerPaymentId: 'payment-1',
  kind: 'refund' as const,
  scope: 'partial' as const,
  accessAction: 'keep' as const,
  amountMinor: 10_000,
  currency: 'TRY' as const,
  status: 'processing' as const,
  providerRefundRef: null,
  cancellationRequestId: null,
  cancellationStatus: null,
  dispatchable: true,
  duplicate: false,
}

function ports(calls: string[]): PlatformSubscriptionRefundPort {
  return {
    prepare: async () => { calls.push('prepare'); return ok(preparation) },
    complete: async () => {
      calls.push('complete')
      return ok({ ...preparation, providerRefundRef: 'refund-1', status: 'succeeded', dispatchable: false })
    },
    fail: async ({ requiresReconciliation }) => {
      calls.push(requiresReconciliation ? 'reconcile' : 'fail')
      return ok({ ...preparation, status: requiresReconciliation ? 'requires_reconciliation' : 'failed', dispatchable: false })
    },
  }
}

test('finance refund dispatches once and only verified provider success completes money movement', async () => {
  const calls: string[] = []
  const provider: SubscriptionRefundProvider = { execute: async () => {
    calls.push('provider')
    return { outcome: 'succeeded', providerPaymentId: 'payment-1', providerRefundRef: 'refund-1', amountMinor: 10_000 }
  } }
  const result = await requestPlatformSubscriptionRefund(actor, input, ports(calls), provider)
  assert.equal(result.ok && result.value.status, 'succeeded')
  assert.deepEqual(calls, ['prepare', 'provider', 'complete'])
})

test('provider timeout is persisted for reconciliation and is never blindly retried', async () => {
  const calls: string[] = []
  const result = await requestPlatformSubscriptionRefund(actor, input, ports(calls), {
    execute: async () => ({ outcome: 'uncertain', code: 'provider_timeout' }),
  })
  assert.equal(result.ok && result.value.status, 'requires_reconciliation')
  assert.deepEqual(calls, ['prepare', 'reconcile'])

  const duplicatePort = ports(calls)
  duplicatePort.prepare = async () => ok({ ...preparation, status: 'requires_reconciliation', dispatchable: false, duplicate: true })
  const replay = await requestPlatformSubscriptionRefund(actor, input, duplicatePort, {
    execute: async () => { calls.push('unexpected-provider'); return { outcome: 'uncertain', code: 'no' } },
  })
  assert.equal(replay.ok && replay.value.duplicate, true)
  assert.ok(!calls.includes('unexpected-provider'))
})

test('non-finance platform actors cannot enter the refund port', async () => {
  let prepared = 0
  const port = ports([])
  port.prepare = async () => { prepared += 1; return ok(preparation) }
  const result = await requestPlatformSubscriptionRefund({ ...actor, role: 'support' }, input, port, {
    execute: async () => ({ outcome: 'rejected', code: 'no' }),
  })
  assert.deepEqual(result, { ok: false, error: 'Not authorized' })
  assert.equal(prepared, 0)
})

test('same-day cancellation forces immediate access cancellation through every boundary', async () => {
  const calls: string[] = []
  let preparedAccess = ''
  let providerAccess = ''
  const sameDayPort = ports(calls)
  sameDayPort.prepare = async (prepared) => {
    preparedAccess = prepared.accessAction
    return ok({ ...preparation, kind: 'same_day_cancel', scope: 'full', accessAction: 'cancel_immediately' })
  }
  const result = await requestPlatformSubscriptionRefund(actor, {
    ...input, kind: 'same_day_cancel', accessAction: 'keep',
  }, sameDayPort, {
    execute: async (providerInput) => {
      providerAccess = providerInput.accessAction
      return { outcome: 'rejected', code: 'declined' }
    },
  })
  assert.equal(result.ok && result.value.status, 'failed')
  assert.equal(preparedAccess, 'cancel_immediately')
  assert.equal(providerAccess, 'cancel_immediately')
})
