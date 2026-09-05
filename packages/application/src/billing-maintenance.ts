import { createHash } from 'node:crypto'
import type { PlatformBillingWorkerContext } from '@garsonless/domain/context'
import { err, ok, type Result } from '@garsonless/domain/result'
import {
  recoverClaimedSubscriptionCheckout,
  type BillingCheckoutRecoveryJob,
  type SubscriptionBillingOperationsPort,
  type SubscriptionBillingProvider,
  type SubscriptionCheckoutRecoveryPort,
  type SubscriptionRenewalProvider,
  type BillingSubscriptionOrderEvidence,
} from './billing'

export type { BillingCheckoutRecoveryJob } from './billing'

export const BILLING_DUNNING_STEPS = ['retry', 'warning_3', 'warning_7', 'suspend'] as const
export type BillingDunningStep = (typeof BILLING_DUNNING_STEPS)[number]

export type BillingDunningJob = {
  runId: string
  restaurantId: string
  subscriptionId: string
  invoiceId: string
  step: BillingDunningStep
}

export type BillingReconciliationJob = {
  jobId: string
  restaurantId: string | null
  subscriptionId: string | null
  scope: 'subscription' | 'invoice' | 'provider_event' | 'tenant'
}

export type BillingRenewalHydrationJob = {
  jobId: string
  providerEventId: string
  restaurantId: string
  subscriptionId: string
  eventType: 'invoice.payment_succeeded' | 'invoice.payment_failed'
  providerCustomerRef: string
  providerSubscriptionRef: string
  providerInvoiceRef: string
  occurredAt: string
  attempts: number
}

export type BillingScheduledCancellationJob = {
  cancellationRequestId: string
  cancellationTargetId: string
  cancellationMode: 'period_end' | 'immediate_refund'
  operationId: string
  restaurantId: string
  subscriptionId: string
  providerSubscriptionRef: string
  providerCancelAt: string
  effectiveAt: string
  attempts: number
}

export type BillingLifecycleNotificationResult = {
  trialReminders: number
  onboardingReminders: number
  expiredTrials: number
}

export interface BillingMaintenancePort {
  enqueueLifecycleNotifications(input: {
    limit: number
    occurredAt: string
  }): Promise<Result<BillingLifecycleNotificationResult>>
  enqueueUpcomingInvoiceReminders(input: {
    limit: number
    occurredAt: string
  }): Promise<Result<number>>
  applyPaidPlanChanges(input: {
    limit: number
    occurredAt: string
  }): Promise<Result<number>>
  claimScheduledCancellations(input: {
    workerId: string
    limit: number
    leaseSeconds: number
    occurredAt: string
  }): Promise<Result<BillingScheduledCancellationJob[]>>
  completeScheduledCancellation(input: {
    job: BillingScheduledCancellationJob
    workerId: string
    providerCancelledAt: string
    occurredAt: string
  }): Promise<Result<{
    cancellationRequestId: string
    subscriptionId: string
    status: 'processing' | 'provider_cancelled' | 'applied'
    requestCompleted: boolean
    duplicate: boolean
  }>>
  failScheduledCancellation(input: {
    job: BillingScheduledCancellationJob
    workerId: string
    reason: string
  }): Promise<Result<true>>
  applyDueCancellationAccess(input: {
    limit: number
    occurredAt: string
  }): Promise<Result<{ applied: number; reconciled: number }>>
  claimCheckoutRecovery(input: {
    workerId: string
    limit: number
    leaseSeconds: number
  }): Promise<Result<BillingCheckoutRecoveryJob[]>>
  claimDunning(input: { workerId: string; limit: number; leaseSeconds: number }): Promise<Result<BillingDunningJob[]>>
  claimRenewalHydration(input: {
    workerId: string
    limit: number
    leaseSeconds: number
  }): Promise<Result<BillingRenewalHydrationJob[]>>
  hydrateRenewal(input: {
    job: BillingRenewalHydrationJob
    workerId: string
    evidence: BillingSubscriptionOrderEvidence
  }): Promise<Result<{ invoiceId: string; invoiceStatus: string; duplicate: boolean }>>
  failRenewalHydration(input: {
    jobId: string
    providerEventId: string
    workerId: string
    reason: string
    retryDelaySeconds: number
  }): Promise<Result<true>>
  advanceDunning(input: {
    runId: string
    workerId: string
    completedStep: BillingDunningStep
    occurredAt: string
  }): Promise<Result<'advanced' | 'completed' | 'stopped'>>
  failDunning(input: {
    runId: string
    workerId: string
    reason: string
    retryDelaySeconds: number
  }): Promise<Result<true>>
  claimReconciliation(input: {
    workerId: string
    limit: number
    leaseSeconds: number
  }): Promise<Result<BillingReconciliationJob[]>>
  escalateReconciliation(input: {
    jobId: string
    workerId: string
    discrepancyCode: 'manual_review_required'
    occurredAt: string
  }): Promise<Result<true>>
  failReconciliation(input: {
    jobId: string
    workerId: string
    reason: string
    retryDelaySeconds: number
  }): Promise<Result<true>>
}

export type BillingMaintenanceBatchResult = {
  lifecycleNotifications: BillingLifecycleNotificationResult
  upcomingReminders: { enqueued: number }
  planChanges: { applied: number }
  cancellations: { claimed: number; applied: number; reconciled: number }
  checkoutRecovery: { claimed: number; active: number; incomplete: number; expired: number; ambiguous: number; failed: number }
  renewalHydration: { claimed: number; hydrated: number; deferred: number; failed: number }
  dunning: { claimed: number; advanced: number; stopped: number; failed: number }
  reconciliation: { claimed: number; escalated: number; failed: number }
}

function isWorkerContext(context: PlatformBillingWorkerContext): boolean {
  return context.actor === 'platform-billing-worker'
    && context.provider === 'iyzico'
    && context.workerId.trim().length > 0
    && context.workerId.length <= 160
}

function boundedLimit(value: number): number | null {
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : null
}

function retryDelay(attempt: number): number {
  return Math.min(30 * 2 ** Math.min(7, Math.max(0, attempt)), 3_600)
}

function retryOperationInput(job: BillingDunningJob): {
  restaurantId: string
  invoiceId: string
  idempotencyKey: string
  requestFingerprint: string
} {
  const idempotencyKey = `dunning:${job.runId}:retry`
  return {
    restaurantId: job.restaurantId,
    invoiceId: job.invoiceId,
    idempotencyKey,
    requestFingerprint: createHash('sha256')
      .update(`${job.restaurantId}\n${job.subscriptionId}\n${job.invoiceId}\n${idempotencyKey}`)
      .digest('hex'),
  }
}

/**
 * Runs one bounded scheduler tick. A provider retry being accepted is not a
 * payment success. Signed renewal webhooks with new order references are
 * hydrated through an authenticated provider search before the same atomic
 * payment transition is allowed to run.
 * Reconciliation is deliberately escalated, never auto-healed (ADR-0002).
 */
export async function processBillingMaintenanceBatch(
  context: PlatformBillingWorkerContext,
  input: { limit?: number; leaseSeconds?: number; occurredAt?: string },
  port: BillingMaintenancePort,
  operations: Pick<
    SubscriptionBillingOperationsPort,
    'prepareRetry' | 'completeOperation' | 'markOperationForReconciliation' | 'finalizeCheckout'
  > & SubscriptionCheckoutRecoveryPort,
  provider: Pick<SubscriptionBillingProvider, 'retryInvoice' | 'probeCheckout'>
    & Partial<SubscriptionRenewalProvider>
    & Partial<Pick<SubscriptionBillingProvider, 'cancelSubscription'>>,
): Promise<Result<BillingMaintenanceBatchResult>> {
  if (!isWorkerContext(context)) return err('Billing maintenance worker context is invalid')
  const limit = boundedLimit(input.limit ?? 20)
  const leaseSeconds = boundedLimit(input.leaseSeconds ?? 60)
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!limit || !leaseSeconds || !Number.isFinite(Date.parse(occurredAt))) {
    return err('Billing maintenance batch input is invalid')
  }

  const result: BillingMaintenanceBatchResult = {
    lifecycleNotifications: { trialReminders: 0, onboardingReminders: 0, expiredTrials: 0 },
    upcomingReminders: { enqueued: 0 },
    planChanges: { applied: 0 },
    cancellations: { claimed: 0, applied: 0, reconciled: 0 },
    checkoutRecovery: { claimed: 0, active: 0, incomplete: 0, expired: 0, ambiguous: 0, failed: 0 },
    renewalHydration: { claimed: 0, hydrated: 0, deferred: 0, failed: 0 },
    dunning: { claimed: 0, advanced: 0, stopped: 0, failed: 0 },
    reconciliation: { claimed: 0, escalated: 0, failed: 0 },
  }
  const lifecycleNotifications = await port.enqueueLifecycleNotifications({ limit, occurredAt })
  if (!lifecycleNotifications.ok) return lifecycleNotifications
  result.lifecycleNotifications = lifecycleNotifications.value

  const upcomingReminders = await port.enqueueUpcomingInvoiceReminders({ limit, occurredAt })
  if (!upcomingReminders.ok) return upcomingReminders
  result.upcomingReminders.enqueued = upcomingReminders.value

  const appliedPlanChanges = await port.applyPaidPlanChanges({ limit, occurredAt })
  if (!appliedPlanChanges.ok) return appliedPlanChanges
  result.planChanges.applied = appliedPlanChanges.value

  const cancellationJobs = await port.claimScheduledCancellations({
    workerId: context.workerId,
    limit,
    leaseSeconds,
    occurredAt,
  })
  if (!cancellationJobs.ok) return cancellationJobs
  result.cancellations.claimed = cancellationJobs.value.length
  for (const job of cancellationJobs.value) {
    try {
      if (!provider.cancelSubscription) {
        throw new Error('Billing cancellation provider capability is unavailable')
      }
      const cancelled = await provider.cancelSubscription({
        providerSubscriptionRef: job.providerSubscriptionRef,
        idempotencyKey: `billing:cancellation-target:${job.cancellationTargetId}`,
      })
      if (!cancelled.ok) throw new Error(cancelled.error)
      const providerCancelledAt = cancelled.value.cancelledAt ?? occurredAt
      const completed = await port.completeScheduledCancellation({
        job,
        workerId: context.workerId,
        providerCancelledAt,
        occurredAt,
      })
      if (!completed.ok) throw new Error(completed.error)
      if (completed.value.requestCompleted) result.cancellations.applied += 1
    } catch (cause) {
      const failed = await port.failScheduledCancellation({
        job,
        workerId: context.workerId,
        reason: cause instanceof Error ? cause.message : 'Billing scheduled cancellation failed',
      })
      if (!failed.ok) return err('Billing scheduled cancellation failure could not be persisted')
      result.cancellations.reconciled += 1
    }
  }

  // Provider renewal was cut off before the boundary. Only now may local
  // access end. This runs before renewal hydration so both paths serialize on
  // the subscription row; a renewal that already advanced the paid period is
  // retained and quarantined instead of being overwritten by cancellation.
  const dueCancellationAccess = await port.applyDueCancellationAccess({ limit, occurredAt })
  if (!dueCancellationAccess.ok) return dueCancellationAccess
  result.cancellations.applied += dueCancellationAccess.value.applied
  result.cancellations.reconciled += dueCancellationAccess.value.reconciled

  const checkoutRecoveries = await port.claimCheckoutRecovery({
    workerId: context.workerId,
    limit,
    leaseSeconds,
  })
  if (!checkoutRecoveries.ok) return checkoutRecoveries
  result.checkoutRecovery.claimed = checkoutRecoveries.value.length
  for (const job of checkoutRecoveries.value) {
    const recovered = await recoverClaimedSubscriptionCheckout(
      job,
      { workerId: context.workerId, occurredAt },
      operations as SubscriptionBillingOperationsPort & SubscriptionCheckoutRecoveryPort,
      provider,
    )
    if (!recovered.ok) {
      result.checkoutRecovery.failed += 1
      continue
    }
    result.checkoutRecovery[recovered.value.outcome] += 1
  }

  const hydrationJobs = await port.claimRenewalHydration({
    workerId: context.workerId,
    limit,
    leaseSeconds,
  })
  if (!hydrationJobs.ok) return hydrationJobs
  result.renewalHydration.claimed = hydrationJobs.value.length
  for (const job of hydrationJobs.value) {
    try {
      if (!provider.retrieveSubscriptionOrder) throw new Error('Billing renewal provider capability is unavailable')
      const evidence = await provider.retrieveSubscriptionOrder({
        providerCustomerRef: job.providerCustomerRef,
        providerSubscriptionRef: job.providerSubscriptionRef,
        providerInvoiceRef: job.providerInvoiceRef,
        idempotencyKey: `billing:renewal-hydration:${job.providerEventId}:${job.attempts}`,
      })
      if (!evidence.ok) throw new Error(evidence.error)
      if (evidence.value.status === 'pending') {
        const deferred = await port.failRenewalHydration({
          jobId: job.jobId,
          providerEventId: job.providerEventId,
          workerId: context.workerId,
          reason: 'Provider renewal order is still pending',
          retryDelaySeconds: retryDelay(job.attempts),
        })
        if (!deferred.ok) return err('Billing renewal hydration deferral could not be persisted')
        result.renewalHydration.deferred += 1
        continue
      }
      const hydrated = await port.hydrateRenewal({ job, workerId: context.workerId, evidence: evidence.value })
      if (!hydrated.ok) throw new Error(hydrated.error)
      result.renewalHydration.hydrated += 1
    } catch (cause) {
      result.renewalHydration.failed += 1
      const failed = await port.failRenewalHydration({
        jobId: job.jobId,
        providerEventId: job.providerEventId,
        workerId: context.workerId,
        reason: cause instanceof Error ? cause.message : 'Billing renewal hydration failed',
        retryDelaySeconds: retryDelay(job.attempts),
      })
      if (!failed.ok) return err('Billing renewal hydration failure could not be persisted')
    }
  }

  const claimed = await port.claimDunning({ workerId: context.workerId, limit, leaseSeconds })
  if (!claimed.ok) return claimed
  result.dunning.claimed = claimed.value.length

  for (const [index, job] of claimed.value.entries()) {
    try {
      if (job.step === 'retry') {
        const operationInput = retryOperationInput(job)
        const prepared = await operations.prepareRetry(operationInput)
        if (!prepared.ok) throw new Error(prepared.error)
        if (!prepared.value.dispatchable) {
          if (!['succeeded', 'requires_reconciliation'].includes(prepared.value.status)) {
            throw new Error('Billing retry operation is already in progress')
          }
        } else {
          const accepted = await provider.retryInvoice({
            providerPaymentRef: prepared.value.providerPaymentRef,
            invoiceId: prepared.value.invoiceId,
            idempotencyKey: operationInput.idempotencyKey,
          })
          if (!accepted.ok) {
            const marked = await operations.markOperationForReconciliation({
              operationId: prepared.value.operationId,
              reason: accepted.error,
            })
            if (!marked.ok) throw new Error('Billing retry and reconciliation tracking failed')
            throw new Error(accepted.error)
          }
          const completed = await operations.completeOperation({
            operationId: prepared.value.operationId,
            result: { accepted: true },
          })
          if (!completed.ok) {
            const marked = await operations.markOperationForReconciliation({
              operationId: prepared.value.operationId,
              reason: completed.error,
            })
            if (!marked.ok) throw new Error('Billing retry completion and reconciliation tracking failed')
            throw new Error('Billing retry requires reconciliation')
          }
        }
      }
      const advanced = await port.advanceDunning({
        runId: job.runId,
        workerId: context.workerId,
        completedStep: job.step,
        occurredAt,
      })
      if (!advanced.ok) throw new Error(advanced.error)
      if (advanced.value === 'stopped') result.dunning.stopped += 1
      else result.dunning.advanced += 1
    } catch (cause) {
      result.dunning.failed += 1
      const failed = await port.failDunning({
        runId: job.runId,
        workerId: context.workerId,
        reason: cause instanceof Error ? cause.message : 'Billing dunning step failed',
        retryDelaySeconds: retryDelay(index),
      })
      if (!failed.ok) return err('Billing dunning failure could not be persisted')
    }
  }

  const reconciliations = await port.claimReconciliation({
    workerId: context.workerId,
    limit,
    leaseSeconds,
  })
  if (!reconciliations.ok) return reconciliations
  result.reconciliation.claimed = reconciliations.value.length
  for (const [index, job] of reconciliations.value.entries()) {
    const escalated = await port.escalateReconciliation({
      jobId: job.jobId,
      workerId: context.workerId,
      discrepancyCode: 'manual_review_required',
      occurredAt,
    })
    if (escalated.ok) {
      result.reconciliation.escalated += 1
      continue
    }
    result.reconciliation.failed += 1
    const failed = await port.failReconciliation({
      jobId: job.jobId,
      workerId: context.workerId,
      reason: escalated.error,
      retryDelaySeconds: retryDelay(index),
    })
    if (!failed.ok) return err('Billing reconciliation failure could not be persisted')
  }

  return ok(result)
}
