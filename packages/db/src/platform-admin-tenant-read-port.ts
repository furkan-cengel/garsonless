import type {
  NormalizedPlatformTenantListInput,
  PlatformTenantDetail,
  PlatformTenantInvoice,
  PlatformTenantPage,
  PlatformTenantReadPort,
  PlatformTenantSubscription,
  PlatformTenantSummary,
  PlatformTenantUsage,
} from '@garsonless/application/platform-admin-tenants'
import {
  isPlatformTenantCurrency,
  isPlatformTenantInvoiceStatus,
  isPlatformTenantSubscriptionStatus,
} from '@garsonless/application/platform-admin-tenants'
import { SUBSCRIPTION_STATUSES } from '@garsonless/domain/billing'
import { RESTAURANT_PLANS } from '@garsonless/domain/entitlements'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformTenantReadRpc = (
  name: 'list_platform_admin_tenants' | 'read_platform_admin_tenant',
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object')
  return value as Record<string, unknown>
}

function nullableString(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('invalid nullable string')
  return value
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('invalid timestamp')
  return value
}

function nullableTimestamp(value: unknown): string | null {
  const parsed = nullableString(value)
  if (parsed !== null && Number.isNaN(Date.parse(parsed))) throw new Error('invalid timestamp')
  return parsed
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('invalid count')
  return value as number
}

function parseUsage(value: unknown): PlatformTenantUsage {
  const row = record(value)
  return {
    tables: count(row.tables),
    menuItems: count(row.menuItems),
    teamMembers: count(row.teamMembers),
    activeOrders: count(row.activeOrders),
    openServiceRequests: count(row.openServiceRequests),
  }
}

function parseSubscription(value: unknown): PlatformTenantSubscription | null {
  if (value === null) return null
  const row = record(value)
  if (
    !RESTAURANT_PLANS.includes(row.plan as never)
    || !isPlatformTenantSubscriptionStatus(row.status)
    || row.status === 'none'
    || !SUBSCRIPTION_STATUSES.includes(row.status)
  ) throw new Error('invalid subscription')
  return {
    plan: row.plan as PlatformTenantSubscription['plan'],
    status: row.status,
    currentPeriodEnd: nullableTimestamp(row.currentPeriodEnd),
    trialEndsAt: nullableTimestamp(row.trialEndsAt),
    graceEndsAt: nullableTimestamp(row.graceEndsAt),
  }
}

function parseInvoice(value: unknown): PlatformTenantInvoice | null {
  if (value === null) return null
  const row = record(value)
  if (typeof row.id !== 'string' || !UUID.test(row.id) || !isPlatformTenantInvoiceStatus(row.status)) {
    throw new Error('invalid invoice')
  }
  if (!isPlatformTenantCurrency(row.currency)) throw new Error('invalid currency')
  return {
    id: row.id,
    status: row.status,
    amountDueMinor: count(row.amountDueMinor),
    amountPaidMinor: count(row.amountPaidMinor),
    currency: row.currency,
    dueAt: nullableTimestamp(row.dueAt),
    paidAt: nullableTimestamp(row.paidAt),
    failedAt: nullableTimestamp(row.failedAt),
    createdAt: timestamp(row.createdAt),
  }
}

function parseSummary(value: unknown): PlatformTenantSummary {
  const row = record(value)
  const attention = record(row.attention)
  if (
    typeof row.id !== 'string' || !UUID.test(row.id)
    || typeof row.name !== 'string' || row.name.length < 1
    || typeof row.slug !== 'string' || row.slug.length < 1
    || typeof row.timezone !== 'string' || row.timezone.length < 1
    || !RESTAURANT_PLANS.includes(row.plan as never)
  ) throw new Error('invalid tenant')
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan as PlatformTenantSummary['plan'],
    timezone: row.timezone,
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
    deletedAt: nullableTimestamp(row.deletedAt),
    subscription: parseSubscription(row.subscription),
    latestInvoice: parseInvoice(row.latestInvoice),
    usage: parseUsage(row.usage),
    attention: { reconciliationCount: count(attention.reconciliationCount) },
  }
}

function parsePage(value: unknown, input: NormalizedPlatformTenantListInput): PlatformTenantPage {
  const row = record(value)
  if (!Array.isArray(row.items)) throw new Error('invalid tenant list')
  return {
    items: row.items.map(parseSummary),
    totalCount: count(row.totalCount),
    page: input.page,
    pageSize: input.pageSize,
  }
}

function parseDetail(value: unknown): PlatformTenantDetail | null {
  if (value === null) return null
  const row = record(value)
  const summary = parseSummary(row)
  if (!Array.isArray(row.invoices)) throw new Error('invalid invoices')
  const invoices = row.invoices.map((invoice) => {
    const parsed = parseInvoice(invoice)
    if (!parsed) throw new Error('invalid invoice')
    return parsed
  })
  const activity = record(row.activity)
  return {
    ...summary,
    invoices,
    activity: { lastOrderAt: nullableTimestamp(activity.lastOrderAt) },
  }
}

export function createPlatformAdminTenantReadPort(rpc?: PlatformTenantReadRpc): PlatformTenantReadPort {
  const call = () => {
    if (rpc) return rpc
    const service = createServiceClient()
    return service.rpc.bind(service) as unknown as PlatformTenantReadRpc
  }
  return {
    async listTenants(input) {
      try {
        const { data, error } = await call()('list_platform_admin_tenants', {
          p_search: input.search,
          p_plan: input.plan,
          p_subscription_status: input.subscriptionStatus,
          p_lifecycle: input.lifecycle,
          p_limit: input.pageSize,
          p_offset: (input.page - 1) * input.pageSize,
        })
        if (error) return err('platform_tenant_directory_query_failed')
        return ok(parsePage(data, input))
      } catch {
        return err('platform_tenant_directory_query_failed')
      }
    },
    async readTenant(tenantId) {
      try {
        const { data, error } = await call()('read_platform_admin_tenant', { p_restaurant_id: tenantId })
        if (error) return err('platform_tenant_detail_query_failed')
        return ok(parseDetail(data))
      } catch {
        return err('platform_tenant_detail_query_failed')
      }
    },
  }
}
