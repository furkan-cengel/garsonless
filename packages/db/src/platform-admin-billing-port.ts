import type {
  PlatformBillingTimelineItem,
  PlatformTenantBillingReadPort,
  PlatformTenantBillingTimeline,
} from '@garsonless/application/platform-admin-billing'
import {
  isPlatformBillingCurrency,
  isPlatformBillingTimelineAction,
  isPlatformBillingTimelineKind,
  isPlatformBillingTimelineStatus,
} from '@garsonless/application/platform-admin-billing'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformTenantBillingRpc = (
  name: 'read_platform_admin_tenant_billing_timeline',
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
