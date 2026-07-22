import type {
  BillingDunningJob,
  BillingDunningStep,
  BillingMaintenancePort,
  BillingReconciliationJob,
} from '@garsonless/application/billing-maintenance'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './client'

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

export function createBillingMaintenancePort(
  rpc: BillingMaintenanceRpc = serviceRpc(),
): BillingMaintenancePort {
  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await rpc(name, args)
    return error ? err(error.message) : ok(data)
  }
  return {
    async claimDunning(input) {
      const result = await call('claim_billing_dunning', {
        p_worker: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
      })
      return result.ok ? dunningJobs(result.value) : result
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
