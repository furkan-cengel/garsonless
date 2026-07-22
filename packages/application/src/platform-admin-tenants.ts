import {
  BILLING_CURRENCY,
  SUBSCRIPTION_INVOICE_STATUSES,
  SUBSCRIPTION_STATUSES,
  type BillingCurrency,
  type SubscriptionInvoiceStatus,
  type SubscriptionStatus,
} from '@garsonless/domain/billing'
import {
  RESTAURANT_PLANS,
  type RestaurantPlan,
} from '@garsonless/domain/entitlements'
import {
  platformAdminCan,
  type PlatformAdminActorContext,
} from '@garsonless/domain/platform-admin'
import { err, type Result } from '@garsonless/domain/result'

export const PLATFORM_TENANT_LIFECYCLES = ['active', 'deleted', 'all'] as const
export type PlatformTenantLifecycle = typeof PLATFORM_TENANT_LIFECYCLES[number]
export type PlatformTenantSubscriptionFilter = SubscriptionStatus | 'none'

export type PlatformTenantUsage = {
  tables: number
  menuItems: number
  teamMembers: number
  activeOrders: number
  openServiceRequests: number
}

export type PlatformTenantSubscription = {
  plan: RestaurantPlan
  status: SubscriptionStatus
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  graceEndsAt: string | null
}

export type PlatformTenantInvoice = {
  id: string
  status: SubscriptionInvoiceStatus
  amountDueMinor: number
  amountPaidMinor: number
  currency: BillingCurrency
  dueAt: string | null
  paidAt: string | null
  failedAt: string | null
  createdAt: string
}

export type PlatformTenantSummary = {
  id: string
  name: string
  slug: string
  plan: RestaurantPlan
  timezone: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  subscription: PlatformTenantSubscription | null
  latestInvoice: PlatformTenantInvoice | null
  usage: PlatformTenantUsage
  attention: {
    reconciliationCount: number
  }
}

export type PlatformTenantDetail = PlatformTenantSummary & {
  invoices: PlatformTenantInvoice[]
  activity: {
    lastOrderAt: string | null
  }
}

export type PlatformTenantPage = {
  items: PlatformTenantSummary[]
  totalCount: number
  page: number
  pageSize: number
}

export type PlatformTenantListInput = {
  search?: string | null
  plan?: RestaurantPlan | null
  subscriptionStatus?: PlatformTenantSubscriptionFilter | null
  lifecycle?: PlatformTenantLifecycle | null
  page?: number | null
  pageSize?: number | null
}

export type NormalizedPlatformTenantListInput = {
  search: string | null
  plan: RestaurantPlan | null
  subscriptionStatus: PlatformTenantSubscriptionFilter | null
  lifecycle: PlatformTenantLifecycle
  page: number
  pageSize: number
}

export interface PlatformTenantReadPort {
  listTenants(input: NormalizedPlatformTenantListInput): Promise<Result<PlatformTenantPage>>
  readTenant(tenantId: string): Promise<Result<PlatformTenantDetail | null>>
}

export type PlatformTenantReadError =
  | 'Not authorized'
  | 'Invalid tenant query'
  | 'Invalid tenant id'
  | 'Tenant directory could not be loaded'
  | 'Tenant could not be loaded'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAGE_SIZES = [10, 25, 50] as const

function normalizeListInput(input: PlatformTenantListInput): NormalizedPlatformTenantListInput | null {
  const search = input.search?.trim() || null
  if (search && search.length > 100) return null
  if (input.plan != null && !RESTAURANT_PLANS.includes(input.plan)) return null
  if (
    input.subscriptionStatus != null
    && input.subscriptionStatus !== 'none'
    && !SUBSCRIPTION_STATUSES.includes(input.subscriptionStatus)
  ) return null
  const lifecycle = input.lifecycle ?? 'active'
  if (!PLATFORM_TENANT_LIFECYCLES.includes(lifecycle)) return null
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 25
  if (!Number.isInteger(page) || page < 1 || page > 400) return null
  if (!PAGE_SIZES.includes(pageSize as typeof PAGE_SIZES[number])) return null
  return {
    search,
    plan: input.plan ?? null,
    subscriptionStatus: input.subscriptionStatus ?? null,
    lifecycle,
    page,
    pageSize,
  }
}

export async function listPlatformTenants(
  actor: PlatformAdminActorContext,
  input: PlatformTenantListInput,
  port: PlatformTenantReadPort,
): Promise<Result<PlatformTenantPage, PlatformTenantReadError>> {
  if (!platformAdminCan(actor, 'tenants.read')) return err('Not authorized')
  const normalized = normalizeListInput(input)
  if (!normalized) return err('Invalid tenant query')
  const result = await port.listTenants(normalized)
  return result.ok ? result : err('Tenant directory could not be loaded')
}

export async function readPlatformTenant(
  actor: PlatformAdminActorContext,
  tenantId: string,
  port: PlatformTenantReadPort,
): Promise<Result<PlatformTenantDetail | null, PlatformTenantReadError>> {
  if (!platformAdminCan(actor, 'tenants.read')) return err('Not authorized')
  if (!UUID.test(tenantId)) return err('Invalid tenant id')
  const result = await port.readTenant(tenantId)
  return result.ok ? result : err('Tenant could not be loaded')
}

export function isPlatformTenantSubscriptionStatus(value: unknown): value is PlatformTenantSubscriptionFilter {
  return value === 'none' || SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
}

export function isPlatformTenantInvoiceStatus(value: unknown): value is SubscriptionInvoiceStatus {
  return SUBSCRIPTION_INVOICE_STATUSES.includes(value as SubscriptionInvoiceStatus)
}

export function isPlatformTenantCurrency(value: unknown): value is BillingCurrency {
  return value === BILLING_CURRENCY
}
