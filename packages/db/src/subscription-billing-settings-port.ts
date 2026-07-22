import type {
  SubscriptionBillingAddress,
  SubscriptionBillingProfile,
  SubscriptionBillingSettings,
  SubscriptionBillingSettingsInvoice,
  SubscriptionBillingSettingsReadPort,
  SubscriptionBillingSettingsSubscription,
} from '@garsonless/application/billing'
import { SUBSCRIPTION_INVOICE_STATUSES, SUBSCRIPTION_STATUSES } from '@garsonless/domain/billing'
import { RESTAURANT_PLANS } from '@garsonless/domain/entitlements'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './client'

export type SubscriptionBillingSettingsRpc = (
  name: 'read_subscription_billing_settings',
  args: { p_restaurant_id: string },
) => Promise<{ data: unknown; error: { message: string } | null }>

function serviceRpc(): SubscriptionBillingSettingsRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as SubscriptionBillingSettingsRpc
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : text(value) ?? undefined
}

function timestamp(value: unknown): string | null {
  const parsed = text(value)
  return parsed && Number.isFinite(Date.parse(parsed)) ? parsed : null
}

function nullableTimestamp(value: unknown): string | null | undefined {
  return value === null ? null : timestamp(value) ?? undefined
}

function address(value: unknown): SubscriptionBillingAddress | null {
  const row = object(value)
  const contactName = text(row?.contactName)
  const city = text(row?.city)
  const country = text(row?.country)
  const line = text(row?.address)
  const district = nullableText(row?.district ?? null)
  const zipCode = nullableText(row?.zipCode ?? null)
  return row && contactName && city && country && line
    && district !== undefined && zipCode !== undefined
    ? { contactName, city, country, address: line, district, zipCode }
    : null
}

function profile(value: unknown): SubscriptionBillingProfile | null | undefined {
  if (value === null) return null
  const row = object(value)
  const billingAddress = address(row?.billingAddress)
  const shippingAddress = address(row?.shippingAddress)
  const legalName = text(row?.legalName)
  const name = text(row?.name)
  const surname = text(row?.surname)
  const identityNumber = text(row?.identityNumber)
  const email = text(row?.email)
  const gsmNumber = text(row?.gsmNumber)
  return row && billingAddress && shippingAddress && legalName && name && surname
    && identityNumber && email && gsmNumber
    ? { legalName, name, surname, identityNumber, email, gsmNumber, billingAddress, shippingAddress }
    : undefined
}

function subscription(value: unknown): SubscriptionBillingSettingsSubscription | null | undefined {
  if (value === null) return null
  const row = object(value)
  const id = text(row?.id)
  const plan = row?.plan
  const scheduledPlan = row?.scheduledPlan
  const status = row?.status
  const currentPeriodStart = nullableTimestamp(row?.currentPeriodStart ?? null)
  const currentPeriodEnd = nullableTimestamp(row?.currentPeriodEnd ?? null)
  const trialEndsAt = nullableTimestamp(row?.trialEndsAt ?? null)
  const graceEndsAt = nullableTimestamp(row?.graceEndsAt ?? null)
  const cancelledAt = nullableTimestamp(row?.cancelledAt ?? null)
  if (!row || !id || !RESTAURANT_PLANS.includes(plan as never)
    || !(scheduledPlan === null || RESTAURANT_PLANS.includes(scheduledPlan as never))
    || !SUBSCRIPTION_STATUSES.includes(status as never)
    || currentPeriodStart === undefined || currentPeriodEnd === undefined
    || trialEndsAt === undefined || graceEndsAt === undefined || cancelledAt === undefined) return undefined
  return {
    id,
    plan: plan as SubscriptionBillingSettingsSubscription['plan'],
    scheduledPlan: scheduledPlan as SubscriptionBillingSettingsSubscription['scheduledPlan'],
    status: status as SubscriptionBillingSettingsSubscription['status'],
    currentPeriodStart, currentPeriodEnd, trialEndsAt, graceEndsAt, cancelledAt,
  }
}

function invoice(value: unknown): SubscriptionBillingSettingsInvoice | null {
  const row = object(value)
  const id = text(row?.id)
  const plan = row?.plan
  const status = row?.status
  const periodStart = timestamp(row?.periodStart)
  const periodEnd = timestamp(row?.periodEnd)
  const dueAt = timestamp(row?.dueAt)
  const paidAt = nullableTimestamp(row?.paidAt ?? null)
  const failedAt = nullableTimestamp(row?.failedAt ?? null)
  if (!row || !id || !['starter', 'pro', 'enterprise'].includes(plan as string)
    || !SUBSCRIPTION_INVOICE_STATUSES.includes(status as never)
    || !Number.isSafeInteger(row.amountDueMinor) || (row.amountDueMinor as number) < 0
    || !Number.isSafeInteger(row.amountPaidMinor) || (row.amountPaidMinor as number) < 0
    || row.currency !== 'TRY' || !periodStart || !periodEnd || !dueAt
    || paidAt === undefined || failedAt === undefined || typeof row.canRetry !== 'boolean') return null
  return {
    id,
    plan: plan as SubscriptionBillingSettingsInvoice['plan'],
    amountDueMinor: row.amountDueMinor as number,
    amountPaidMinor: row.amountPaidMinor as number,
    currency: 'TRY', status: status as SubscriptionBillingSettingsInvoice['status'],
    periodStart, periodEnd, dueAt, paidAt, failedAt, canRetry: row.canRetry,
  }
}

function parse(value: unknown): Result<SubscriptionBillingSettings> {
  const row = object(value)
  const parsedProfile = profile(row?.profile)
  const parsedSubscription = subscription(row?.subscription)
  const invoices = Array.isArray(row?.invoices) ? row.invoices.map(invoice) : null
  const attention = object(row?.attention)
  const nextDunningActionAt = nullableTimestamp(attention?.nextDunningActionAt ?? null)
  if (!row || parsedProfile === undefined || parsedSubscription === undefined
    || !invoices || invoices.some((item) => item === null) || !attention
    || !Number.isInteger(attention.reconciliationCount) || (attention.reconciliationCount as number) < 0
    || typeof attention.hasPendingCheckout !== 'boolean' || nextDunningActionAt === undefined) {
    return err('Billing settings projection is invalid')
  }
  return ok({
    profile: parsedProfile,
    subscription: parsedSubscription,
    invoices: invoices as SubscriptionBillingSettingsInvoice[],
    attention: {
      reconciliationCount: attention.reconciliationCount as number,
      hasPendingCheckout: attention.hasPendingCheckout,
      nextDunningActionAt,
    },
  })
}

export function createSubscriptionBillingSettingsReadPort(
  rpc: SubscriptionBillingSettingsRpc = serviceRpc(),
): SubscriptionBillingSettingsReadPort {
  return {
    async readSettings({ restaurantId }) {
      const { data, error } = await rpc('read_subscription_billing_settings', { p_restaurant_id: restaurantId })
      return error ? err('Billing settings could not be loaded') : parse(data)
    },
  }
}
