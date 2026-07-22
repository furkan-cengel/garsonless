import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain/result'
import {
  processBillingMaintenanceBatch,
  type BillingMaintenancePort,
} from './billing-maintenance'
import type { SubscriptionBillingOperationsPort } from './billing'

const context = { actor: 'platform-billing-worker', provider: 'iyzico', workerId: 'worker-1' } as const

function port(calls: string[]): BillingMaintenancePort {
  return {
    claimDunning: async () => ok([
      { runId: 'run-1', restaurantId: 'r1', subscriptionId: 's1', invoiceId: 'i1', step: 'retry' },
      { runId: 'run-2', restaurantId: 'r2', subscriptionId: 's2', invoiceId: 'i2', step: 'warning_7' },
    ]),
    advanceDunning: async (input) => { calls.push(`advance:${input.runId}:${input.completedStep}`); return ok('advanced') },
    failDunning: async (input) => { calls.push(`fail:${input.runId}`); return ok(true) },
    claimReconciliation: async () => ok([
      { jobId: 'recon-1', restaurantId: 'r1', subscriptionId: 's1', scope: 'invoice' },
    ]),
    escalateReconciliation: async (input) => { calls.push(`escalate:${input.jobId}`); return ok(true) },
    failReconciliation: async (input) => { calls.push(`recon-fail:${input.jobId}`); return ok(true) },
  }
}

function operations(
  calls: string[],
  status: 'processing' | 'succeeded' | 'requires_reconciliation' = 'processing',
): Pick<
  SubscriptionBillingOperationsPort,
  'prepareRetry' | 'completeOperation' | 'markOperationForReconciliation'
> {
  return {
    prepareRetry: async (input) => {
      calls.push(`prepare:${input.idempotencyKey}:${input.requestFingerprint.length}`)
      return ok({
        operationId: 'operation-1',
        invoiceId: input.invoiceId,
        providerPaymentRef: 'ledger-payment-1',
        dispatchable: status === 'processing',
        duplicate: status !== 'processing',
        status,
      })
    },
    completeOperation: async (input) => {
      calls.push(`complete:${input.operationId}`)
      return ok(true)
    },
    markOperationForReconciliation: async (input) => {
      calls.push(`mark-reconciliation:${input.operationId}`)
      return ok(true)
    },
  }
}

test('maintenance retries only retry step, advances warnings and escalates reconciliation', async () => {
  const calls: string[] = []
  const provider = {
    retryInvoice: async (input: { providerPaymentRef: string; invoiceId: string; idempotencyKey: string }) => {
      calls.push(`provider:${input.idempotencyKey}`)
      return ok({ accepted: true as const })
    },
  }
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-07-22T12:00:00.000Z' },
    port(calls),
    operations(calls),
    provider,
  )
  assert.deepEqual(result, ok({
    dunning: { claimed: 2, advanced: 2, stopped: 0, failed: 0 },
    reconciliation: { claimed: 1, escalated: 1, failed: 0 },
  }))
  assert.deepEqual(calls, [
    'prepare:dunning:run-1:retry:64',
    'provider:dunning:run-1:retry',
    'complete:operation-1',
    'advance:run-1:retry',
    'advance:run-2:warning_7',
    'escalate:recon-1',
  ])
})

test('provider failure is persisted and never treated as a payment success', async () => {
  const calls: string[] = []
  const provider = { retryInvoice: async () => err('provider unavailable') }
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-07-22T12:00:00.000Z' },
    port(calls),
    operations(calls),
    provider,
  )
  assert.ok(result.ok)
  assert.equal(result.value.dunning.failed, 1)
  assert.ok(calls.includes('mark-reconciliation:operation-1'))
  assert.ok(calls.includes('fail:run-1'))
  assert.ok(!calls.includes('advance:run-1:retry'))
})

test('maintenance rejects forged worker identity before claiming work', async () => {
  const calls: string[] = []
  const result = await processBillingMaintenanceBatch(
    { ...context, workerId: '' },
    {},
    port(calls),
    operations(calls),
    { retryInvoice: async () => ok({ accepted: true }) },
  )
  assert.deepEqual(result, { ok: false, error: 'Billing maintenance worker context is invalid' })
  assert.deepEqual(calls, [])
})

test('a succeeded durable retry replay advances without a second provider dispatch', async () => {
  const calls: string[] = []
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-07-22T12:00:00.000Z' },
    port(calls),
    operations(calls, 'succeeded'),
    { retryInvoice: async () => {
      calls.push('unexpected-provider-dispatch')
      return ok({ accepted: true })
    } },
  )
  assert.ok(result.ok)
  assert.equal(result.value.dunning.advanced, 2)
  assert.ok(!calls.includes('unexpected-provider-dispatch'))
  assert.ok(calls.includes('advance:run-1:retry'))
})

test('an ambiguous durable retry advances warnings without risking a second provider charge', async () => {
  const calls: string[] = []
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-07-22T12:00:00.000Z' },
    port(calls),
    operations(calls, 'requires_reconciliation'),
    { retryInvoice: async () => {
      calls.push('unexpected-provider-dispatch')
      return ok({ accepted: true })
    } },
  )
  assert.ok(result.ok)
  assert.equal(result.value.dunning.advanced, 2)
  assert.ok(!calls.includes('unexpected-provider-dispatch'))
  assert.ok(calls.includes('advance:run-1:retry'))
})
