import {
  PLATFORM_TENANT_LIFECYCLES,
  type PlatformTenantLifecycle,
  type PlatformTenantListInput,
  type PlatformTenantSubscriptionFilter,
} from '@garsonless/application/platform-admin-tenants'
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from '@garsonless/domain/billing'
import { RESTAURANT_PLANS, type RestaurantPlan } from '@garsonless/domain/entitlements'

type RawSearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  return Number(value)
}

export function parseTenantSearchParams(params: RawSearchParams): PlatformTenantListInput {
  const search = one(params.q)
  const plan = one(params.plan)
  const status = one(params.status)
  const lifecycle = one(params.lifecycle)
  return {
    search,
    plan: RESTAURANT_PLANS.includes(plan as RestaurantPlan) ? plan as RestaurantPlan : plan ? plan as never : null,
    subscriptionStatus: status === 'none' || SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)
      ? status as PlatformTenantSubscriptionFilter
      : status ? status as never : null,
    lifecycle: PLATFORM_TENANT_LIFECYCLES.includes(lifecycle as PlatformTenantLifecycle)
      ? lifecycle as PlatformTenantLifecycle
      : lifecycle ? lifecycle as never : null,
    page: positiveInteger(one(params.page)),
    pageSize: positiveInteger(one(params.pageSize)),
  }
}

export function queryHref(input: PlatformTenantListInput, page: number): string {
  const query = new URLSearchParams()
  if (input.search) query.set('q', input.search)
  if (input.plan) query.set('plan', input.plan)
  if (input.subscriptionStatus) query.set('status', input.subscriptionStatus)
  if (input.lifecycle) query.set('lifecycle', input.lifecycle)
  query.set('page', String(page))
  if (input.pageSize) query.set('pageSize', String(input.pageSize))
  return `/?${query.toString()}`
}

export function formatMoney(minor: number, currency = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(minor / 100)
}

export function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value))
}

export const PLAN_LABELS: Record<RestaurantPlan, string> = {
  starter: 'Starter', plus: 'Plus', pro: 'Pro', business: 'Business',
}

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  trial: 'Deneme', trial_expired: 'Deneme süresi doldu', active: 'Aktif', past_due: 'Ödeme gecikti', grace_period: 'Ek süre',
  suspended: 'Askıda', cancelled: 'İptal', manual_hold: 'Manuel bekletme',
  refund_cancel_pending: 'İptal ediliyor',
}

export function subscriptionTone(status: SubscriptionStatus | null): string {
  if (status === 'active' || status === 'trial') return 'success'
  if (status === 'past_due' || status === 'grace_period') return 'warning'
  if (status === 'trial_expired' || status === 'suspended' || status === 'refund_cancel_pending' || status === 'cancelled' || status === 'manual_hold') return 'danger'
  return 'neutral'
}

const PLATFORM_ROLE_LABELS: Record<string, string> = {
  support: 'Destek',
  ops: 'Operasyon',
  finance: 'Finans',
  superadmin: 'Süper yönetici',
}

export function platformRoleLabel(role: string): string {
  return PLATFORM_ROLE_LABELS[role] ?? role
}

const BILLING_STATUS_LABELS: Record<string, string> = {
  paid: 'Ödendi', past_due: 'Gecikti', uncollectible: 'Tahsil edilemedi',
  open: 'Açık', draft: 'Taslak', void: 'İptal', pending: 'Bekliyor',
  scheduled: 'Planlandı', failed: 'Başarısız', succeeded: 'Başarılı',
  processed: 'İşlendi', processing: 'İşleniyor', resolved: 'Çözüldü',
  completed: 'Tamamlandı', stopped: 'Durduruldu', dead_lettered: 'Teslim edilemedi',
  discrepancy: 'Uyuşmazlık', requires_reconciliation: 'İnceleme gerekli',
}

export function billingStatusLabel(status: string): string {
  return BILLING_STATUS_LABELS[status] ?? status
}
