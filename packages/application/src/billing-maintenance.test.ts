import assert from 'node:assert/strict'
import test from 'node:test'
import { err, ok } from '@garsonless/domain/result'
import {
  processBillingMaintenanceBatch,
  type BillingMaintenancePort,
} from './billing-maintenance'
import type { SubscriptionBillingOperationsPort, SubscriptionCheckoutRecoveryPort } from './billing'

const context = { actor: 'platform-billing-worker', provider: 'iyzico', workerId: 'worker-1' } as const

function port(calls: string[]): BillingMaintenancePort {
  return {
    enqueueLifecycleNotifications: async () => ok({ trialReminders: 0, onboardingReminders: 0, expiredTrials: 0 }),
    enqueueUpcomingInvoiceReminders: async () => ok(0),
    applyPaidPlanChanges: async () => ok(0),
    claimScheduledCancellations: async () => ok([]),
    completeScheduledCancellation: async () => ok({
      cancellationRequestId: 'cancel-request-1', subscriptionId: 's1',
      status: 'applied', requestCompleted: true, duplicate: false,
    }),
    failScheduledCancellation: async () => ok(true),
    applyDueCancellationAccess: async () => ok({ applied: 0, reconciled: 0 }),
    claimCheckoutRecovery: async () => ok([]),
    claimRenewalHydration: async () => ok([]),
    hydrateRenewal: async () => ok({ invoiceId: 'renewal-invoice', invoiceStatus: 'paid', duplicate: false }),
    failRenewalHydration: async () => ok(true),
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
  'prepareRetry' | 'completeOperation' | 'markOperationForReconciliation' | 'finalizeCheckout'
> & SubscriptionCheckoutRecoveryPort {
  return {
    finalizeCheckout: async () => {
      calls.push('finalize-checkout')
      return ok({
        restaurantId: 'r1', subscriptionId: 's1', invoiceId: 'i1',
        invoiceStatus: 'paid', paymentEvidence: 'authenticated_retrieve', duplicate: false,
      })
    },
    claimCheckoutRecoveryOperation: async () => err('unused'),
    rescheduleCheckoutRecovery: async () => ok(true),
    expireCheckoutRecovery: async () => ok(true),
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

const probeCheckout = async () => ok({ outcome: 'incomplete' as const })

test('maintenance retries only retry step, advances warnings and escalates reconciliation', async () => {
  const calls: string[] = []
  const provider = {
    probeCheckout,
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
    lifecycleNotifications: { trialReminders: 0, onboardingReminders: 0, expiredTrials: 0 },
    upcomingReminders: { enqueued: 0 },
    planChanges: { applied: 0 },
    cancellations: { claimed: 0, applied: 0, reconciled: 0 },
    checkoutRecovery: { claimed: 0, active: 0, incomplete: 0, expired: 0, ambiguous: 0, failed: 0 },
    renewalHydration: { claimed: 0, hydrated: 0, deferred: 0, failed: 0 },
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

test('maintenance enqueues the bounded upcoming window before provider work', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  maintenance.enqueueUpcomingInvoiceReminders = async (input) => {
    calls.push(`upcoming:${input.limit}:${input.occurredAt}`)
    return ok(2)
  }
  const result = await processBillingMaintenanceBatch(
    context,
    { limit: 10, occurredAt: '2026-07-22T12:00:00.000Z' },
    maintenance,
    operations(calls),
    { probeCheckout, retryInvoice: async () => ok({ accepted: true }) },
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.upcomingReminders, { enqueued: 2 })
  assert.equal(calls[0], 'upcoming:10:2026-07-22T12:00:00.000Z')
})

test('maintenance schedules lifecycle occurrences before renewal work', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  maintenance.enqueueLifecycleNotifications = async (input) => {
    calls.push(`lifecycle:${input.limit}:${input.occurredAt}`)
    return ok({ trialReminders: 2, onboardingReminders: 1, expiredTrials: 1 })
  }
  maintenance.enqueueUpcomingInvoiceReminders = async () => { calls.push('upcoming'); return ok(0) }
  const result = await processBillingMaintenanceBatch(
    context,
    { limit: 10, occurredAt: '2026-09-01T12:00:00.000Z' },
    maintenance,
    operations(calls),
    { probeCheckout, retryInvoice: async () => ok({ accepted: true }) },
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.lifecycleNotifications, {
    trialReminders: 2, onboardingReminders: 1, expiredTrials: 1,
  })
  assert.deepEqual(calls.slice(0, 2), [
    'lifecycle:10:2026-09-01T12:00:00.000Z', 'upcoming',
  ])
})

test('maintenance applies paid plan changes before provider work', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  maintenance.enqueueUpcomingInvoiceReminders = async () => { calls.push('upcoming'); return ok(0) }
  maintenance.applyPaidPlanChanges = async (input) => {
    calls.push(`plan-changes:${input.limit}:${input.occurredAt}`)
    return ok(2)
  }
  const result = await processBillingMaintenanceBatch(
    context,
    { limit: 10, occurredAt: '2026-07-22T12:00:00.000Z' },
    maintenance,
    operations(calls),
    { probeCheckout, retryInvoice: async () => ok({ accepted: true }) },
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.planChanges, { applied: 2 })
  assert.deepEqual(calls.slice(0, 2), [
    'upcoming',
    'plan-changes:10:2026-07-22T12:00:00.000Z',
  ])
})

test('maintenance cuts off provider renewal before period end without ending paid access', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  maintenance.claimScheduledCancellations = async (input) => {
    calls.push(`claim-cancel:${input.workerId}:${input.occurredAt}`)
    return ok([{
      cancellationRequestId: 'cancel-request-1', operationId: 'operation-cancel-1',
      cancellationTargetId: 'cancel-target-1', cancellationMode: 'period_end',
      restaurantId: 'r1', subscriptionId: 's1',
      providerSubscriptionRef: 'provider-subscription-1',
      providerCancelAt: '2026-08-31T12:00:00.000Z',
      effectiveAt: '2026-09-01T12:00:00.000Z', attempts: 1,
    }])
  }
  maintenance.completeScheduledCancellation = async (input) => {
    calls.push(`complete-cancel:${input.job.operationId}:${input.providerCancelledAt}`)
    return ok({
      cancellationRequestId: input.job.cancellationRequestId,
      subscriptionId: input.job.subscriptionId,
      status: 'provider_cancelled', duplicate: false,
      requestCompleted: false,
    })
  }
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-08-31T12:00:00.000Z' },
    maintenance,
    operations(calls),
    {
      probeCheckout,
      retryInvoice: async () => ok({ accepted: true }),
      cancelSubscription: async (input) => {
        calls.push(`provider-cancel:${input.providerSubscriptionRef}:${input.idempotencyKey}`)
        return ok({ cancelledAt: '2026-08-31T12:00:01.000Z' })
      },
    },
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.cancellations, { claimed: 1, applied: 0, reconciled: 0 })
  assert.ok(calls.includes('claim-cancel:worker-1:2026-08-31T12:00:00.000Z'))
  assert.ok(calls.includes('provider-cancel:provider-subscription-1:billing:cancellation-target:cancel-target-1'))
  assert.ok(calls.includes('complete-cancel:operation-cancel-1:2026-08-31T12:00:01.000Z'))
})

test('ambiguous period-end provider cancellation is quarantined without closing access cleanly', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  const job = {
    cancellationRequestId: 'cancel-request-1', operationId: 'operation-cancel-1',
    cancellationTargetId: 'cancel-target-1', cancellationMode: 'period_end' as const,
    restaurantId: 'r1', subscriptionId: 's1', providerSubscriptionRef: 'provider-subscription-1',
    providerCancelAt: '2026-08-31T12:00:00.000Z',
    effectiveAt: '2026-09-01T12:00:00.000Z', attempts: 1,
  }
  maintenance.claimScheduledCancellations = async () => ok([job])
  maintenance.failScheduledCancellation = async ({ reason }) => {
    calls.push(`reconcile-cancel:${reason}`)
    return ok(true)
  }
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-09-01T12:00:00.000Z' },
    maintenance,
    operations(calls),
    {
      probeCheckout,
      retryInvoice: async () => ok({ accepted: true }),
      cancelSubscription: async () => err('provider result ambiguous'),
    },
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.cancellations, { claimed: 1, applied: 0, reconciled: 1 })
  assert.ok(calls.includes('reconcile-cancel:provider result ambiguous'))
})

test('period-end access resolution precedes renewal work and replay does not reapply it', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  maintenance.applyDueCancellationAccess = async () => {
    calls.push('apply-cancellation-access')
    return ok({ applied: 0, reconciled: 1 })
  }
  maintenance.claimRenewalHydration = async () => {
    calls.push('claim-renewal-hydration')
    return ok([])
  }
  const first = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-09-01T12:00:00.000Z' },
    maintenance,
    operations(calls),
    { probeCheckout, retryInvoice: async () => ok({ accepted: true }) },
  )
  assert.ok(first.ok)
  assert.deepEqual(first.value.cancellations, { claimed: 0, applied: 0, reconciled: 1 })
  assert.ok(calls.indexOf('apply-cancellation-access') < calls.indexOf('claim-renewal-hydration'))

  maintenance.applyDueCancellationAccess = async () => ok({ applied: 0, reconciled: 0 })
  const replay = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-09-01T12:01:00.000Z' },
    maintenance,
    operations([]),
    { probeCheckout, retryInvoice: async () => ok({ accepted: true }) },
  )
  assert.ok(replay.ok)
  assert.deepEqual(replay.value.cancellations, { claimed: 0, applied: 0, reconciled: 0 })
})

test('maintenance hydrates a signed renewal event before dunning', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  maintenance.claimRenewalHydration = async () => ok([{
    jobId: 'job-renewal', providerEventId: 'event-renewal',
    restaurantId: 'r1', subscriptionId: 's1',
    eventType: 'invoice.payment_succeeded',
    providerCustomerRef: 'customer-1', providerSubscriptionRef: 'subscription-1',
    providerInvoiceRef: 'order-2', occurredAt: '2026-08-22T12:00:00.000Z', attempts: 1,
  }])
  maintenance.hydrateRenewal = async ({ evidence }) => {
    calls.push(`hydrate:${evidence.providerInvoiceRef}:${evidence.status}`)
    return ok({ invoiceId: 'invoice-2', invoiceStatus: 'paid', duplicate: false })
  }
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-08-22T12:00:00.000Z' },
    maintenance,
    operations(calls),
    {
      probeCheckout,
      retryInvoice: async () => ok({ accepted: true }),
      retrieveSubscriptionOrder: async () => ok({
        providerCustomerRef: 'customer-1', providerSubscriptionRef: 'subscription-1',
        providerInvoiceRef: 'order-2', providerPaymentId: 'payment-2',
        providerPlanRef: 'plan-pro', plan: 'pro',
        addOns: [], billingInterval: 'monthly', amount: { minor: 143_880, currency: 'TRY' },
        periodStart: '2026-08-22T12:00:00.000Z', periodEnd: '2026-09-22T12:00:00.000Z',
        status: 'succeeded',
      }),
    },
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.renewalHydration, { claimed: 1, hydrated: 1, deferred: 0, failed: 0 })
  assert.ok(calls.includes('hydrate:order-2:succeeded'))
})

test('provider failure is persisted and never treated as a payment success', async () => {
  const calls: string[] = []
  const provider = { probeCheckout, retryInvoice: async () => err('provider unavailable') }
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
    { probeCheckout, retryInvoice: async () => ok({ accepted: true }) },
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
    { probeCheckout, retryInvoice: async () => {
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
    { probeCheckout, retryInvoice: async () => {
      calls.push('unexpected-provider-dispatch')
      return ok({ accepted: true })
    } },
  )
  assert.ok(result.ok)
  assert.equal(result.value.dunning.advanced, 2)
  assert.ok(!calls.includes('unexpected-provider-dispatch'))
  assert.ok(calls.includes('advance:run-1:retry'))
})

test('maintenance recovers an active hosted checkout before dunning and finalizes it once', async () => {
  const calls: string[] = []
  const maintenance = port(calls)
  maintenance.claimCheckoutRecovery = async () => ok([{
    operationId: 'operation-checkout', restaurantId: 'r1',
    providerCheckoutRef: 'checkout-token', expectedProviderPlanRef: 'plan-pro',
    expectedAmount: { minor: 143_880, currency: 'TRY' }, expectedBillingInterval: 'monthly',
    expiresAt: '2027-07-22T12:00:00.000Z', attempts: 1,
  }])
  const result = await processBillingMaintenanceBatch(
    context,
    { occurredAt: '2026-07-22T12:00:00.000Z' },
    maintenance,
    operations(calls),
    {
      retryInvoice: async () => ok({ accepted: true }),
      probeCheckout: async () => ok({
        outcome: 'active',
        checkout: {
          providerCustomerRef: 'customer-ref', providerSubscriptionRef: 'subscription-ref',
          providerPlanRef: 'plan-pro', providerInvoiceRef: 'invoice-ref', providerPaymentId: 'payment-ref',
          providerOrderStatus: 'succeeded', amount: { minor: 143_880, currency: 'TRY' },
          periodStart: '2026-07-22T12:00:00.000Z', periodEnd: '2026-08-22T12:00:00.000Z',
          status: 'active',
        },
      }),
    },
  )
  assert.ok(result.ok)
  assert.deepEqual(result.value.checkoutRecovery, {
    claimed: 1, active: 1, incomplete: 0, expired: 0, ambiguous: 0, failed: 0,
  })
  assert.equal(calls.filter((entry) => entry === 'finalize-checkout').length, 1)
})
