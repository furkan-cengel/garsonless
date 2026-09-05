import assert from 'node:assert/strict'
import test from 'node:test'
import { createBillingMaintenancePort, type BillingMaintenanceRpc } from './billing-maintenance-port'

test('billing maintenance adapter validates claimed dunning and reconciliation rows', async () => {
  const calls: string[] = []
  const rpc: BillingMaintenanceRpc = async (name) => {
    calls.push(name)
    if (name === 'enqueue_subscription_lifecycle_notifications') return { data: {
      trialReminders: 2, onboardingReminders: 1, expiredTrials: 1,
    }, error: null }
    if (name === 'enqueue_subscription_upcoming_invoice_reminders') return { data: 2, error: null }
    if (name === 'apply_paid_subscription_plan_changes') return { data: 1, error: null }
    if (name === 'claim_subscription_cancellations_before_renewal') return { data: [{
      cancellationRequestId: 'cancel-request-1', operationId: 'cancel-operation-1',
      cancellationTargetId: 'cancel-target-1', cancellationMode: 'period_end',
      restaurantId: 'r1', subscriptionId: 's1', providerSubscriptionRef: 'provider-subscription-1',
      providerCancelAt: '2026-08-31T12:00:00.000Z',
      effectiveAt: '2026-09-01T12:00:00.000Z', attempts: 1,
    }], error: null }
    if (name === 'complete_subscription_cancellation_provider_cutoff') return { data: {
      cancellationRequestId: 'cancel-request-1', subscriptionId: 's1',
      status: 'applied', requestCompleted: true, duplicate: false,
    }, error: null }
    if (name === 'claim_subscription_checkout_recovery') return { data: [{
      operationId: 'op-1', restaurantId: 'r1', providerCheckoutRef: 'checkout-1',
      expectedProviderPlanRef: 'plan-1', expiresAt: '2026-09-01T12:30:00.000Z', attempts: 1,
      expectedAmountMinor: 143_880, expectedCurrency: 'TRY', expectedBillingInterval: 'monthly',
    }], error: null }
    if (name === 'apply_due_subscription_cancellation_access') return {
      data: { applied: 1, reconciled: 0 }, error: null,
    }
    if (name === 'claim_subscription_invoice_hydration') return { data: [{
      jobId: 'hydration-1', providerEventId: 'event-1', restaurantId: 'r1', subscriptionId: 's1',
      eventType: 'invoice.payment_succeeded', providerCustomerRef: 'customer-1',
      providerSubscriptionRef: 'subscription-1', providerInvoiceRef: 'order-1',
      occurredAtEpochMs: 1788264000000, attempts: 1,
    }], error: null }
    if (name === 'claim_billing_dunning') return { data: [{
      run_id: 'run-1', restaurant_id: 'r1', subscription_id: 's1', invoice_id: 'i1',
      step: 'retry',
    }], error: null }
    if (name === 'claim_billing_reconciliation') return { data: [{
      job_id: 'job-1', restaurant_id: null, subscription_id: null, scope: 'provider_event',
    }], error: null }
    return { data: true, error: null }
  }
  const port = createBillingMaintenancePort(rpc)
  const lifecycle = await port.enqueueLifecycleNotifications({ limit: 10, occurredAt: '2026-09-01T12:00:00.000Z' })
  const upcoming = await port.enqueueUpcomingInvoiceReminders({ limit: 10, occurredAt: '2026-09-01T12:00:00.000Z' })
  const planChanges = await port.applyPaidPlanChanges({ limit: 10, occurredAt: '2026-09-01T12:00:00.000Z' })
  const cancellations = await port.claimScheduledCancellations({
    workerId: 'w1', limit: 10, leaseSeconds: 60, occurredAt: '2026-09-01T12:00:00.000Z',
  })
  assert.ok(cancellations.ok)
  const completedCancellation = await port.completeScheduledCancellation({
    job: cancellations.value[0]!, workerId: 'w1',
    providerCancelledAt: '2026-09-01T12:00:01.000Z',
    occurredAt: '2026-09-01T12:00:01.000Z',
  })
  const recoveries = await port.claimCheckoutRecovery({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  const cancellationAccess = await port.applyDueCancellationAccess({
    limit: 10, occurredAt: '2026-09-01T12:00:00.000Z',
  })
  const hydrations = await port.claimRenewalHydration({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  const dunning = await port.claimDunning({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  const reconciliation = await port.claimReconciliation({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  assert.ok(dunning.ok)
  assert.deepEqual(lifecycle, { ok: true, value: {
    trialReminders: 2, onboardingReminders: 1, expiredTrials: 1,
  } })
  assert.deepEqual(upcoming, { ok: true, value: 2 })
  assert.deepEqual(planChanges, { ok: true, value: 1 })
  assert.deepEqual(completedCancellation, { ok: true, value: {
    cancellationRequestId: 'cancel-request-1', subscriptionId: 's1',
    status: 'applied', requestCompleted: true, duplicate: false,
  } })
  assert.ok(recoveries.ok)
  assert.deepEqual(cancellationAccess, { ok: true, value: { applied: 1, reconciled: 0 } })
  assert.equal(recoveries.value[0]!.operationId, 'op-1')
  assert.ok(hydrations.ok)
  assert.equal(hydrations.value[0]!.providerInvoiceRef, 'order-1')
  assert.equal(dunning.value[0]!.invoiceId, 'i1')
  assert.ok(reconciliation.ok)
  assert.equal(reconciliation.value[0]!.restaurantId, null)
  assert.deepEqual(calls, [
    'enqueue_subscription_lifecycle_notifications', 'enqueue_subscription_upcoming_invoice_reminders', 'apply_paid_subscription_plan_changes',
    'claim_subscription_cancellations_before_renewal', 'complete_subscription_cancellation_provider_cutoff',
    'claim_subscription_checkout_recovery', 'apply_due_subscription_cancellation_access',
    'claim_subscription_invoice_hydration',
    'claim_billing_dunning', 'claim_billing_reconciliation',
  ])
})

test('billing maintenance adapter rejects malformed upcoming reminder counts', async () => {
  const rpc: BillingMaintenanceRpc = async () => ({ data: -1, error: null })
  const result = await createBillingMaintenancePort(rpc).enqueueUpcomingInvoiceReminders({
    limit: 10, occurredAt: '2026-09-01T12:00:00.000Z',
  })
  assert.deepEqual(result, { ok: false, error: 'Billing upcoming reminder result is invalid' })
})

test('billing maintenance adapter rejects malformed RPC projections', async () => {
  const rpc: BillingMaintenanceRpc = async () => ({ data: [{ step: 'unknown' }], error: null })
  const result = await createBillingMaintenancePort(rpc).claimDunning({ workerId: 'w1', limit: 10, leaseSeconds: 60 })
  assert.deepEqual(result, { ok: false, error: 'Billing dunning claim result is invalid' })
})

test('renewal payment identity fault rolls back through one hydration RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const port = createBillingMaintenancePort(async (name, args) => {
    calls.push({ name, args })
    return { data: null, error: { message: 'billing_payment_identity_attempt_mismatch' } }
  })
  const result = await port.hydrateRenewal({
    workerId: 'worker-1',
    job: {
      jobId: 'job-1', providerEventId: 'event-1', restaurantId: 'restaurant-1',
      subscriptionId: 'subscription-1', eventType: 'invoice.payment_succeeded',
      providerCustomerRef: 'customer-1', providerSubscriptionRef: 'provider-subscription-1',
      providerInvoiceRef: 'provider-order-1', occurredAt: '2026-09-01T00:00:00.000Z', attempts: 1,
    },
    evidence: {
      providerCustomerRef: 'customer-1', providerSubscriptionRef: 'provider-subscription-1',
      providerInvoiceRef: 'provider-order-1', providerPaymentId: 'provider-payment-1',
      providerPlanRef: 'provider-plan-1', plan: 'pro', addOns: [], billingInterval: 'monthly',
      amount: { minor: 143_880, currency: 'TRY' },
      periodStart: '2026-09-01T00:00:00.000Z', periodEnd: '2026-10-01T00:00:00.000Z',
      status: 'succeeded',
    },
  })
  assert.deepEqual(result, { ok: false, error: 'billing_payment_identity_attempt_mismatch' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.name, 'hydrate_subscription_invoice_with_payment_identity')
  assert.equal(calls[0]?.args.p_provider_payment_id, 'provider-payment-1')
})
