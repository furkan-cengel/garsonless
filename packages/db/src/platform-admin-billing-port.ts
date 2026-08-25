import type {
  PlatformDunningIntervention,
  PlatformDunningInterventionPort,
  PlatformDunningInterventionResult,
  PlatformBillingTimelineItem,
  PlatformTenantBillingReadPort,
  PlatformTenantBillingTimeline,
} from '@garsonless/application/platform-admin-billing'
import {
  PLATFORM_DUNNING_STATUSES,
  isPlatformBillingCurrency,
  isPlatformBillingTimelineAction,
  isPlatformBillingTimelineKind,
  isPlatformBillingTimelineStatus,
} from '@garsonless/application/platform-admin-billing'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformTenantBillingRpc = (
  name: 'read_platform_admin_tenant_billing_timeline' | 'intervene_platform_admin_billing_dunning',
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object')
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('invalid count')
  return value as number
}

function nullableCount(value: unknown): number | null {
  return value === null ? null : count(value)
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('invalid timestamp')
  return value
}

function nullableTimestamp(value: unknown): string | null {
  return value === null ? null : timestamp(value)
}

function nullableUuid(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('invalid uuid')
  return value
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('invalid boolean')
  return value
}

function isIntervention(value: unknown): value is PlatformDunningIntervention {
  return value === 'retry_now' || value === 'defer'
}

function parseIntervention(value: unknown): PlatformDunningInterventionResult {
  const row = record(value)
  if (
    typeof row.restaurantId !== 'string' || !UUID.test(row.restaurantId)
    || typeof row.invoiceId !== 'string' || !UUID.test(row.invoiceId)
    || typeof row.runId !== 'string' || !UUID.test(row.runId)
    || !isIntervention(row.intervention)
    || !PLATFORM_DUNNING_STATUSES.includes(row.previousStatus as typeof PLATFORM_DUNNING_STATUSES[number])
    || !PLATFORM_DUNNING_STATUSES.includes(row.status as typeof PLATFORM_DUNNING_STATUSES[number])
    || typeof row.requestId !== 'string' || !UUID.test(row.requestId)
  ) throw new Error('invalid dunning intervention')
  return {
    restaurantId: row.restaurantId,
    invoiceId: row.invoiceId,
    runId: row.runId,
    intervention: row.intervention,
    previousStatus: row.previousStatus as typeof PLATFORM_DUNNING_STATUSES[number],
    status: row.status as typeof PLATFORM_DUNNING_STATUSES[number],
    previousNextActionAt: nullableTimestamp(row.previousNextActionAt),
    nextActionAt: timestamp(row.nextActionAt),
    changed: boolean(row.changed),
    duplicate: boolean(row.duplicate),
    requestId: row.requestId,
  }
}

function parseItem(value: unknown): PlatformBillingTimelineItem {
  const row = record(value)
  if (typeof row.id !== 'string' || !UUID.test(row.id) || !isPlatformBillingTimelineKind(row.kind)) {
    throw new Error('invalid timeline item')
  }
  if (!isPlatformBillingTimelineStatus(row.kind, row.status) || !isPlatformBillingTimelineAction(row.kind, row.action)) {
    throw new Error('invalid timeline vocabulary')
  }
  if (row.currency !== null && !isPlatformBillingCurrency(row.currency)) throw new Error('invalid currency')
  if (typeof row.hasError !== 'boolean') throw new Error('invalid error projection')
  return {
    id: row.id,
    kind: row.kind,
    status: row.status as string,
    action: row.action as string,
    occurredAt: timestamp(row.occurredAt),
    invoiceId: nullableUuid(row.invoiceId),
    amountMinor: nullableCount(row.amountMinor),
    currency: row.currency,
    attempt: nullableCount(row.attempt),
    nextActionAt: nullableTimestamp(row.nextActionAt),
    completedAt: nullableTimestamp(row.completedAt),
    hasError: row.hasError,
  }
}

function parseTimeline(value: unknown): PlatformTenantBillingTimeline {
  const row = record(value)
  const summary = record(row.summary)
  if (!isPlatformBillingCurrency(summary.currency) || !Array.isArray(row.items) || row.items.length > 100) {
    throw new Error('invalid billing timeline')
  }
  return {
    summary: {
      outstandingMinor: count(summary.outstandingMinor),
      currency: summary.currency,
      openInvoices: count(summary.openInvoices),
      activeDunning: count(summary.activeDunning),
      openReconciliation: count(summary.openReconciliation),
      failedAttempts: count(summary.failedAttempts),
    },
    items: row.items.map(parseItem),
  }
}

function serviceRpc(): PlatformTenantBillingRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformTenantBillingRpc
}

export function createPlatformAdminTenantBillingReadPort(
  rpc: PlatformTenantBillingRpc = serviceRpc(),
): PlatformTenantBillingReadPort {
  return {
    async readTimeline(input) {
      try {
        const { data, error } = await rpc('read_platform_admin_tenant_billing_timeline', {
          p_restaurant_id: input.restaurantId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
          p_limit: input.limit,
        })
        if (error) return err('platform_billing_timeline_query_failed')
        return ok(parseTimeline(data))
      } catch {
        return err('platform_billing_timeline_query_failed')
      }
    },
  }
}

export function createPlatformAdminDunningInterventionPort(
  rpc: PlatformTenantBillingRpc = serviceRpc(),
): PlatformDunningInterventionPort {
  return {
    async intervene(input) {
      try {
        const { data, error } = await rpc('intervene_platform_admin_billing_dunning', {
          p_restaurant_id: input.restaurantId,
          p_invoice_id: input.invoiceId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
          p_intervention: input.intervention,
          p_defer_days: input.deferDays,
          p_reason: input.reason,
          p_request_id: input.requestId,
        })
        if (error) {
          if (error.message.includes('platform_dunning_run_busy')) return err('platform_dunning_run_busy')
          if (error.message.includes('platform_dunning_not_actionable')) return err('platform_dunning_not_actionable')
          return err('platform_dunning_intervention_failed')
        }
        return ok(parseIntervention(data))
      } catch {
        return err('platform_dunning_intervention_failed')
      }
    },
  }
}
