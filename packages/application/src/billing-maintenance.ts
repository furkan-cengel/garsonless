import { createHash } from 'node:crypto'
import type { PlatformBillingWorkerContext } from '@garsonless/domain/context'
import { err, ok, type Result } from '@garsonless/domain/result'
import type { SubscriptionBillingOperationsPort, SubscriptionBillingProvider } from './billing'

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

export interface BillingMaintenancePort {
  claimDunning(input: { workerId: string; limit: number; leaseSeconds: number }): Promise<Result<BillingDunningJob[]>>
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
 * payment success: the job advances, while the signed webhook remains the
 * only authority that can mark the invoice paid and reactivate the tenant.
 * Reconciliation is deliberately escalated, never auto-healed (ADR-0002).
 */
export async function processBillingMaintenanceBatch(
  context: PlatformBillingWorkerContext,
  input: { limit?: number; leaseSeconds?: number; occurredAt?: string },
  port: BillingMaintenancePort,
  operations: Pick<
    SubscriptionBillingOperationsPort,
    'prepareRetry' | 'completeOperation' | 'markOperationForReconciliation'
  >,
  provider: Pick<SubscriptionBillingProvider, 'retryInvoice'>,
): Promise<Result<BillingMaintenanceBatchResult>> {
  if (!isWorkerContext(context)) return err('Billing maintenance worker context is invalid')
  const limit = boundedLimit(input.limit ?? 20)
  const leaseSeconds = boundedLimit(input.leaseSeconds ?? 60)
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  if (!limit || !leaseSeconds || !Number.isFinite(Date.parse(occurredAt))) {
    return err('Billing maintenance batch input is invalid')
  }

  const result: BillingMaintenanceBatchResult = {
    dunning: { claimed: 0, advanced: 0, stopped: 0, failed: 0 },
    reconciliation: { claimed: 0, escalated: 0, failed: 0 },
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
