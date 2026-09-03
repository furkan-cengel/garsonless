import type {
  BillingCheckoutRecoveryJob,
  BillingDunningJob,
  BillingDunningStep,
  BillingMaintenancePort,
  BillingLifecycleNotificationResult,
  BillingReconciliationJob,
  BillingRenewalHydrationJob,
  BillingScheduledCancellationJob,
} from '@garsonless/application/billing-maintenance'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type BillingMaintenanceRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>

function serviceRpc(): BillingMaintenanceRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as BillingMaintenanceRpc
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : text(value) ?? undefined
}

function dunningStep(value: unknown): BillingDunningStep | null {
  return ['retry', 'warning_3', 'warning_7', 'suspend'].includes(value as string)
    ? value as BillingDunningStep
    : null
}

function dunningJobs(value: unknown): Result<BillingDunningJob[]> {
  if (!Array.isArray(value)) return err('Billing dunning claim result is invalid')
  const jobs: BillingDunningJob[] = []
  for (const valueRow of value) {
    const row = object(valueRow)
    const runId = text(row?.run_id)
    const restaurantId = text(row?.restaurant_id)
    const subscriptionId = text(row?.subscription_id)
    const invoiceId = text(row?.invoice_id)
    const step = dunningStep(row?.step)
    if (!row || !runId || !restaurantId || !subscriptionId || !invoiceId || !step) {
      return err('Billing dunning claim result is invalid')
    }
    jobs.push({ runId, restaurantId, subscriptionId, invoiceId, step })
  }
  return ok(jobs)
}

function checkoutRecoveryJobs(value: unknown): Result<BillingCheckoutRecoveryJob[]> {
  if (!Array.isArray(value)) return err('Billing checkout recovery claim result is invalid')
  const jobs: BillingCheckoutRecoveryJob[] = []
  for (const valueRow of value) {
    const row = object(valueRow)
    const operationId = text(row?.operationId)
    const restaurantId = text(row?.restaurantId)
    const providerCheckoutRef = text(row?.providerCheckoutRef)
    const expectedProviderPlanRef = text(row?.expectedProviderPlanRef)
    const expectedAmountMinor = row?.expectedAmountMinor
    const expectedCurrency = row?.expectedCurrency
    const expectedBillingInterval = row?.expectedBillingInterval
    const expiresAt = text(row?.expiresAt)
    const attempts = row?.attempts
    if (!row || !operationId || !restaurantId || !providerCheckoutRef || !expectedProviderPlanRef
      || typeof expectedAmountMinor !== 'number' || !Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0
      || expectedCurrency !== 'TRY' || !['monthly', 'annual'].includes(expectedBillingInterval as string)
      || !expiresAt || !Number.isFinite(Date.parse(expiresAt))
      || typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1) {
      return err('Billing checkout recovery claim result is invalid')
    }
    jobs.push({
      operationId, restaurantId, providerCheckoutRef, expectedProviderPlanRef,
      expectedAmount: { minor: expectedAmountMinor, currency: 'TRY' },
      expectedBillingInterval: expectedBillingInterval as BillingCheckoutRecoveryJob['expectedBillingInterval'],
      expiresAt, attempts,
    })
  }
  return ok(jobs)
}

function scheduledCancellationJobs(value: unknown): Result<BillingScheduledCancellationJob[]> {
  if (!Array.isArray(value)) return err('Billing scheduled cancellation claim result is invalid')
  const jobs: BillingScheduledCancellationJob[] = []
  for (const valueRow of value) {
    const row = object(valueRow)
    const cancellationRequestId = text(row?.cancellationRequestId)
    const cancellationTargetId = text(row?.cancellationTargetId)
    const cancellationMode = row?.cancellationMode
    const operationId = text(row?.operationId)
    const restaurantId = text(row?.restaurantId)
    const subscriptionId = text(row?.subscriptionId)
    const providerSubscriptionRef = text(row?.providerSubscriptionRef)
    const providerCancelAt = text(row?.providerCancelAt)
    const effectiveAt = text(row?.effectiveAt)
    const attempts = row?.attempts
    if (!row || !cancellationRequestId || !cancellationTargetId || !operationId || !restaurantId || !subscriptionId
      || !['period_end', 'immediate_refund'].includes(cancellationMode as string)
      || !providerSubscriptionRef
      || !providerCancelAt || !Number.isFinite(Date.parse(providerCancelAt))
      || !effectiveAt || !Number.isFinite(Date.parse(effectiveAt))
      || (cancellationMode === 'period_end' && Date.parse(providerCancelAt) >= Date.parse(effectiveAt))
      || typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1) {
      return err('Billing scheduled cancellation claim result is invalid')
    }
    jobs.push({
      cancellationRequestId, cancellationTargetId,
      cancellationMode: cancellationMode as BillingScheduledCancellationJob['cancellationMode'],
      operationId, restaurantId, subscriptionId,
      providerSubscriptionRef, providerCancelAt, effectiveAt, attempts,
    })
  }
  return ok(jobs)
}

function reconciliationJobs(value: unknown): Result<BillingReconciliationJob[]> {
  if (!Array.isArray(value)) return err('Billing reconciliation claim result is invalid')
  const jobs: BillingReconciliationJob[] = []
  for (const valueRow of value) {
    const row = object(valueRow)
    const jobId = text(row?.job_id)
    const restaurantId = nullableText(row?.restaurant_id ?? null)
    const subscriptionId = nullableText(row?.subscription_id ?? null)
    const scope = row?.scope
    if (!row || !jobId || restaurantId === undefined || subscriptionId === undefined
      || !['subscription', 'invoice', 'provider_event', 'tenant'].includes(scope as string)) {
      return err('Billing reconciliation claim result is invalid')
    }
    jobs.push({
      jobId,
      restaurantId,
      subscriptionId,
      scope: scope as BillingReconciliationJob['scope'],
    })
  }
  return ok(jobs)
}

function renewalHydrationJobs(value: unknown): Result<BillingRenewalHydrationJob[]> {
  if (!Array.isArray(value)) return err('Billing renewal hydration claim result is invalid')
  const jobs: BillingRenewalHydrationJob[] = []
  for (const valueRow of value) {
    const row = object(valueRow)
    const jobId = text(row?.jobId)
    const providerEventId = text(row?.providerEventId)
    const restaurantId = text(row?.restaurantId)
    const subscriptionId = text(row?.subscriptionId)
    const providerCustomerRef = text(row?.providerCustomerRef)
    const providerSubscriptionRef = text(row?.providerSubscriptionRef)
    const providerInvoiceRef = text(row?.providerInvoiceRef)
    const eventType = row?.eventType
    const occurredAtEpochMs = row?.occurredAtEpochMs
    const attempts = row?.attempts
    const occurredAt = typeof occurredAtEpochMs === 'number' && Number.isFinite(occurredAtEpochMs)
      ? new Date(occurredAtEpochMs).toISOString()
      : null
    if (!row || !jobId || !providerEventId || !restaurantId || !subscriptionId
      || !providerCustomerRef || !providerSubscriptionRef || !providerInvoiceRef || !occurredAt
      || !['invoice.payment_succeeded', 'invoice.payment_failed'].includes(eventType as string)
      || typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1) {
      return err('Billing renewal hydration claim result is invalid')
    }
    jobs.push({
      jobId, providerEventId, restaurantId, subscriptionId,
      eventType: eventType as BillingRenewalHydrationJob['eventType'],
      providerCustomerRef, providerSubscriptionRef, providerInvoiceRef, occurredAt, attempts,
    })
  }
  return ok(jobs)
}

export function createBillingMaintenancePort(
  rpc: BillingMaintenanceRpc = serviceRpc(),
): BillingMaintenancePort {
  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await rpc(name, args)
    return error ? err(error.message) : ok(data)
  }
  return {
    async enqueueLifecycleNotifications(input) {
      const result = await call('enqueue_subscription_lifecycle_notifications', {
        p_limit: input.limit,
        p_occurred_at: input.occurredAt,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const parsed: BillingLifecycleNotificationResult = {
        trialReminders: Number(row?.trialReminders),
        onboardingReminders: Number(row?.onboardingReminders),
        expiredTrials: Number(row?.expiredTrials),
      }
      return Object.values(parsed).every((value) => Number.isInteger(value) && value >= 0)
        ? ok(parsed)
        : err('Billing lifecycle notification result is invalid')
    },
    async enqueueUpcomingInvoiceReminders(input) {
      const result = await call('enqueue_subscription_upcoming_invoice_reminders', {
        p_limit: input.limit,
        p_occurred_at: input.occurredAt,
      })
      return result.ok && typeof result.value === 'number' && Number.isInteger(result.value) && result.value >= 0
        ? ok(result.value)
        : result.ok ? err('Billing upcoming reminder result is invalid') : result
    },
    async applyPaidPlanChanges(input) {
      const result = await call('apply_paid_subscription_plan_changes', {
        p_limit: input.limit,
        p_occurred_at: input.occurredAt,
      })
      return result.ok && typeof result.value === 'number' && Number.isInteger(result.value) && result.value >= 0
        ? ok(result.value)
        : result.ok ? err('Billing paid plan change result is invalid') : result
    },
    async claimScheduledCancellations(input) {
      const result = await call('claim_subscription_cancellations_before_renewal', {
        p_worker: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
        p_occurred_at: input.occurredAt,
      })
      return result.ok ? scheduledCancellationJobs(result.value) : result
    },
    async completeScheduledCancellation(input) {
      const result = await call('complete_subscription_cancellation_provider_cutoff', {
        p_cancellation_request_id: input.job.cancellationRequestId,
        p_cancellation_target_id: input.job.cancellationTargetId,
        p_operation_id: input.job.operationId,
        p_worker: input.workerId,
        p_provider_cancelled_at: input.providerCancelledAt,
        p_occurred_at: input.occurredAt,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const cancellationRequestId = text(row?.cancellationRequestId)
      const subscriptionId = text(row?.subscriptionId)
      return cancellationRequestId && subscriptionId
        && ['processing', 'provider_cancelled', 'applied'].includes(row?.status as string)
        && typeof row?.requestCompleted === 'boolean'
        && typeof row.duplicate === 'boolean'
        ? ok({
          cancellationRequestId, subscriptionId,
          status: row.status as 'processing' | 'provider_cancelled' | 'applied',
          requestCompleted: row.requestCompleted,
          duplicate: row.duplicate,
        })
        : err('Billing scheduled cancellation completion result is invalid')
    },
    async failScheduledCancellation(input) {
      const result = await call('fail_subscription_cancellation_target', {
        p_cancellation_request_id: input.job.cancellationRequestId,
        p_cancellation_target_id: input.job.cancellationTargetId,
        p_operation_id: input.job.operationId,
        p_worker: input.workerId,
        p_reason: input.reason.slice(0, 1000),
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing scheduled cancellation failure lease was lost') : result
    },
    async applyDueCancellationAccess(input) {
      const result = await call('apply_due_subscription_cancellation_access', {
        p_limit: input.limit,
        p_occurred_at: input.occurredAt,
      })
      if (!result.ok) return result
      const row = object(result.value)
      const applied = row?.applied
      const reconciled = row?.reconciled
      return typeof applied === 'number' && Number.isInteger(applied) && applied >= 0
        && typeof reconciled === 'number' && Number.isInteger(reconciled) && reconciled >= 0
        ? ok({ applied, reconciled })
        : err('Billing cancellation access result is invalid')
    },
    async claimCheckoutRecovery(input) {
      const result = await call('claim_subscription_checkout_recovery', {
        p_worker: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
      })
      return result.ok ? checkoutRecoveryJobs(result.value) : result
    },
    async claimDunning(input) {
      const result = await call('claim_billing_dunning', {
        p_worker: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
      })
      return result.ok ? dunningJobs(result.value) : result
    },
    async claimRenewalHydration(input) {
      const result = await call('claim_subscription_invoice_hydration', {
        p_worker: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
      })
      return result.ok ? renewalHydrationJobs(result.value) : result
    },
    async hydrateRenewal(input) {
      const evidence = input.evidence
      if (evidence.status === 'succeeded' && !evidence.providerPaymentId) {
        return err('Billing renewal payment identity is missing')
      }
      const result = await call('hydrate_subscription_invoice_with_payment_identity', {
        p_job_id: input.job.jobId,
        p_provider_event_id: input.job.providerEventId,
        p_worker: input.workerId,
        p_provider_customer_ref: evidence.providerCustomerRef,
        p_provider_subscription_ref: evidence.providerSubscriptionRef,
        p_provider_invoice_ref: evidence.providerInvoiceRef,
        p_provider_plan_ref: evidence.providerPlanRef,
        p_plan: evidence.plan,
        p_add_ons: evidence.addOns,
        p_billing_interval: evidence.billingInterval,
        p_amount_minor: evidence.amount.minor,
        p_currency: evidence.amount.currency,
        p_period_start: evidence.periodStart,
        p_period_end: evidence.periodEnd,
        p_provider_order_status: evidence.status,
        p_provider_payment_id: evidence.providerPaymentId,
        p_occurred_at: input.job.occurredAt,
      })
      if (!result.ok) return result
      const parsed = object(result.value)
      const invoiceId = text(parsed?.invoiceId)
      const invoiceStatus = text(parsed?.invoiceStatus)
      if (!invoiceId || !invoiceStatus || typeof parsed?.duplicate !== 'boolean') {
        return err('Billing renewal hydration result is invalid')
      }
      return ok({ invoiceId, invoiceStatus, duplicate: parsed.duplicate })
    },
    async failRenewalHydration(input) {
      const result = await call('fail_subscription_invoice_hydration', {
        p_job_id: input.jobId,
        p_provider_event_id: input.providerEventId,
        p_worker: input.workerId,
        p_reason: input.reason.slice(0, 1000),
        p_retry_delay_seconds: input.retryDelaySeconds,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing renewal hydration failure lease was lost') : result
    },
    async advanceDunning(input) {
      const result = await call('advance_billing_dunning', {
        p_run_id: input.runId,
        p_worker: input.workerId,
        p_completed_step: input.completedStep,
        p_occurred_at: input.occurredAt,
      })
      return result.ok && ['advanced', 'completed', 'stopped'].includes(result.value as string)
        ? ok(result.value as 'advanced' | 'completed' | 'stopped')
        : result.ok ? err('Billing dunning advance result is invalid') : result
    },
    async failDunning(input) {
      const result = await call('fail_billing_dunning', {
        p_run_id: input.runId,
        p_worker: input.workerId,
        p_reason: input.reason,
        p_retry_delay_seconds: input.retryDelaySeconds,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing dunning failure lease was lost') : result
    },
    async claimReconciliation(input) {
      const result = await call('claim_billing_reconciliation', {
        p_worker: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
      })
      return result.ok ? reconciliationJobs(result.value) : result
    },
    async escalateReconciliation(input) {
      const result = await call('escalate_billing_reconciliation', {
        p_job_id: input.jobId,
        p_worker: input.workerId,
        p_discrepancy_code: input.discrepancyCode,
        p_occurred_at: input.occurredAt,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing reconciliation escalation lease was lost') : result
    },
    async failReconciliation(input) {
      const result = await call('fail_billing_reconciliation', {
        p_job_id: input.jobId,
        p_worker: input.workerId,
        p_reason: input.reason,
        p_retry_delay_seconds: input.retryDelaySeconds,
      })
      return result.ok && result.value === true
        ? ok(true)
        : result.ok ? err('Billing reconciliation failure lease was lost') : result
    },
  }
}
