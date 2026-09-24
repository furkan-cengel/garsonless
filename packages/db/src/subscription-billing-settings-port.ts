import type {
  SubscriptionBillingAddress,
  SubscriptionBillingProfile,
  SubscriptionBillingSettings,
  SubscriptionBillingSettingsInvoice,
  SubscriptionBillingSettingsRefund,
  SubscriptionBillingSettingsReadPort,
  SubscriptionBillingSettingsSubscription,
} from '@garsonless/application/billing'
import { SUBSCRIPTION_INVOICE_STATUSES, SUBSCRIPTION_STATUSES } from '@garsonless/domain/billing'
import {
  BILLING_INTERVALS,
  RESTAURANT_ADD_ONS,
  RESTAURANT_PLANS,
} from '@garsonless/domain/entitlements'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type SubscriptionBillingSettingsRpc = (
  name: 'read_subscription_billing_settings' | 'read_restaurant_subscription_add_ons',
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
  const billingAddressRow = object(row?.billingAddress)
  const billingAddress = address(row?.billingAddress)
  const shippingAddress = address(row?.shippingAddress)
  const legalName = text(row?.legalName)
  const taxOffice = text(row?.taxOffice) ?? text(billingAddressRow?.taxOffice)
  const name = text(row?.name)
  const surname = text(row?.surname)
  const identityNumber = text(row?.identityNumber)
  const email = text(row?.email)
  const gsmNumber = text(row?.gsmNumber)
  return row && billingAddress && shippingAddress && legalName && taxOffice && name && surname
    && identityNumber && email && gsmNumber
    ? { legalName, taxOffice, name, surname, identityNumber, email, gsmNumber, billingAddress, shippingAddress }
    : undefined
}

function subscription(value: unknown): SubscriptionBillingSettingsSubscription | null | undefined {
  if (value === null) return null
  const row = object(value)
  const id = text(row?.id)
  const plan = row?.plan
  const billingInterval = row?.billingInterval
  const scheduledPlan = row?.scheduledPlan
  const status = row?.status
  const currentPeriodStart = nullableTimestamp(row?.currentPeriodStart ?? null)
  const currentPeriodEnd = nullableTimestamp(row?.currentPeriodEnd ?? null)
  const trialEndsAt = nullableTimestamp(row?.trialEndsAt ?? null)
  const graceEndsAt = nullableTimestamp(row?.graceEndsAt ?? null)
  const cancelledAt = nullableTimestamp(row?.cancelledAt ?? null)
  const activeAddOns = row?.activeAddOns ?? []
  const scheduledAddOns = row?.scheduledAddOns ?? []
  const cancelAtPeriodEnd = row?.cancelAtPeriodEnd ?? false
  const cancellationRequestId = nullableText(row?.cancellationRequestId ?? null)
  const cancellationEffectiveAt = nullableTimestamp(row?.cancellationEffectiveAt ?? null)
  const cancellationStatus = row?.cancellationStatus ?? null
  if (!row || !id || !RESTAURANT_PLANS.includes(plan as never)
    || !BILLING_INTERVALS.includes(billingInterval as never)
    || !(scheduledPlan === null || RESTAURANT_PLANS.includes(scheduledPlan as never))
    || !SUBSCRIPTION_STATUSES.includes(status as never)
    || !Array.isArray(activeAddOns)
    || activeAddOns.some((addOn) => !RESTAURANT_ADD_ONS.includes(addOn as never))
    || !Array.isArray(scheduledAddOns)
    || scheduledAddOns.some((addOn) => !RESTAURANT_ADD_ONS.includes(addOn as never))
    || typeof cancelAtPeriodEnd !== 'boolean'
    || cancellationRequestId === undefined || cancellationEffectiveAt === undefined
    || !(cancellationStatus === null
      || ['scheduled', 'processing', 'provider_cancelled', 'requires_reconciliation'].includes(cancellationStatus as string))
    || currentPeriodStart === undefined || currentPeriodEnd === undefined
    || trialEndsAt === undefined || graceEndsAt === undefined || cancelledAt === undefined) return undefined
  return {
    id,
    plan: plan as SubscriptionBillingSettingsSubscription['plan'],
    billingInterval: billingInterval as SubscriptionBillingSettingsSubscription['billingInterval'],
    scheduledPlan: scheduledPlan as SubscriptionBillingSettingsSubscription['scheduledPlan'],
    status: status as SubscriptionBillingSettingsSubscription['status'],
    currentPeriodStart, currentPeriodEnd, trialEndsAt, graceEndsAt, cancelledAt,
    activeAddOns: activeAddOns as SubscriptionBillingSettingsSubscription['activeAddOns'],
    scheduledAddOns: scheduledAddOns as SubscriptionBillingSettingsSubscription['scheduledAddOns'],
    cancelAtPeriodEnd,
    cancellationRequestId,
    cancellationEffectiveAt,
    cancellationStatus: cancellationStatus as SubscriptionBillingSettingsSubscription['cancellationStatus'],
  }
}

function invoice(value: unknown): SubscriptionBillingSettingsInvoice | null {
  const row = object(value)
  const id = text(row?.id)
  const plan = row?.plan
  const billingInterval = row?.billingInterval
  const status = row?.status
  const periodStart = timestamp(row?.periodStart)
  const periodEnd = timestamp(row?.periodEnd)
  const dueAt = timestamp(row?.dueAt)
  const paidAt = nullableTimestamp(row?.paidAt ?? null)
  const failedAt = nullableTimestamp(row?.failedAt ?? null)
  const addOns = row?.addOns ?? []
  const hasFiscalProjection = row?.fiscalDocumentStatus !== undefined
    || row?.fiscalDocumentType !== undefined || row?.canDownload !== undefined
  const fiscalDocumentStatus = hasFiscalProjection ? row?.fiscalDocumentStatus : 'not_available'
  const fiscalDocumentType = hasFiscalProjection ? row?.fiscalDocumentType : null
  const canDownload = hasFiscalProjection ? row?.canDownload : false
  if (!row || !id || !['starter', 'plus', 'pro'].includes(plan as string)
    || !BILLING_INTERVALS.includes(billingInterval as never)
    || !SUBSCRIPTION_INVOICE_STATUSES.includes(status as never)
    || !Array.isArray(addOns)
    || addOns.some((addOn) => !RESTAURANT_ADD_ONS.includes(addOn as never))
    || !Number.isSafeInteger(row.amountDueMinor) || (row.amountDueMinor as number) < 0
    || !Number.isSafeInteger(row.amountPaidMinor) || (row.amountPaidMinor as number) < 0
    || row.currency !== 'TRY' || !periodStart || !periodEnd || !dueAt
    || paidAt === undefined || failedAt === undefined || typeof row.canRetry !== 'boolean'
    || !['not_available', 'preparing', 'profile_required', 'ready', 'failed'].includes(String(fiscalDocumentStatus))
    || !(fiscalDocumentType === null || ['e_fatura', 'e_arsiv'].includes(String(fiscalDocumentType)))
    || typeof canDownload !== 'boolean'
    || (canDownload && fiscalDocumentStatus !== 'ready')
    || (fiscalDocumentStatus === 'ready' && (!canDownload || fiscalDocumentType === null))) return null
  return {
    id,
    plan: plan as SubscriptionBillingSettingsInvoice['plan'],
    addOns: addOns as SubscriptionBillingSettingsInvoice['addOns'],
    billingInterval: billingInterval as SubscriptionBillingSettingsInvoice['billingInterval'],
    amountDueMinor: row.amountDueMinor as number,
    amountPaidMinor: row.amountPaidMinor as number,
    currency: 'TRY', status: status as SubscriptionBillingSettingsInvoice['status'],
    periodStart, periodEnd, dueAt, paidAt, failedAt, canRetry: row.canRetry,
    fiscalDocumentStatus: fiscalDocumentStatus as SubscriptionBillingSettingsInvoice['fiscalDocumentStatus'],
    fiscalDocumentType: fiscalDocumentType as SubscriptionBillingSettingsInvoice['fiscalDocumentType'],
    canDownload,
  }
}

function refund(value: unknown): SubscriptionBillingSettingsRefund | null {
  const row = object(value)
  const id = text(row?.id)
  const invoiceId = text(row?.invoiceId)
  const requestedAt = timestamp(row?.requestedAt)
  const completedAt = nullableTimestamp(row?.completedAt ?? null)
  const cancellationRequestId = nullableText(row?.cancellationRequestId ?? null)
  const accessAction = row?.accessAction
  const cancellationStatus = row?.cancellationStatus ?? null
  if (!row || !id || !invoiceId
    || !['same_day_cancel', 'refund'].includes(String(row.kind))
    || !['full', 'partial'].includes(String(row.scope))
    || !['keep', 'cancel_immediately'].includes(String(accessAction))
    || !['requested', 'processing', 'succeeded', 'failed', 'requires_reconciliation'].includes(String(row.status))
    || !Number.isSafeInteger(row.amountMinor) || (row.amountMinor as number) <= 0
    || !(cancellationStatus === null
      || ['scheduled', 'processing', 'provider_cancelled', 'applied', 'requires_reconciliation'].includes(String(cancellationStatus)))
    || cancellationRequestId === undefined
    || row.currency !== 'TRY' || !requestedAt || completedAt === undefined) return null
  return {
    id, invoiceId, kind: row.kind as SubscriptionBillingSettingsRefund['kind'],
    scope: row.scope as SubscriptionBillingSettingsRefund['scope'],
    accessAction: accessAction as SubscriptionBillingSettingsRefund['accessAction'],
    amountMinor: row.amountMinor as number, currency: 'TRY',
    status: row.status as SubscriptionBillingSettingsRefund['status'],
    requestedAt, completedAt, cancellationRequestId,
    cancellationStatus: cancellationStatus as SubscriptionBillingSettingsRefund['cancellationStatus'],
  }
}

function parse(value: unknown): Result<SubscriptionBillingSettings> {
  const row = object(value)
  const parsedProfile = profile(row?.profile)
  const parsedSubscription = subscription(row?.subscription)
  const invoices = Array.isArray(row?.invoices) ? row.invoices.map(invoice) : null
  const refunds = row?.refunds === undefined ? [] : Array.isArray(row.refunds) ? row.refunds.map(refund) : null
  const attention = object(row?.attention)
  const nextDunningActionAt = nullableTimestamp(attention?.nextDunningActionAt ?? null)
  if (!row || parsedProfile === undefined || parsedSubscription === undefined
    || !invoices || invoices.some((item) => item === null)
    || !refunds || refunds.some((item) => item === null) || !attention
    || !Number.isInteger(attention.reconciliationCount) || (attention.reconciliationCount as number) < 0
    || typeof attention.hasPendingCheckout !== 'boolean' || nextDunningActionAt === undefined) {
    return err('Billing settings projection is invalid')
  }
  return ok({
    profile: parsedProfile,
    subscription: parsedSubscription,
    invoices: invoices as SubscriptionBillingSettingsInvoice[],
    refunds: refunds as SubscriptionBillingSettingsRefund[],
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
      // Both reads start together; the add-on projection is only used when a
      // subscription exists, so running it in parallel saves a round trip.
      const addOnRequest = Promise.resolve(rpc('read_restaurant_subscription_add_ons', { p_restaurant_id: restaurantId }))
        .catch(() => null)
      const { data, error } = await rpc('read_subscription_billing_settings', { p_restaurant_id: restaurantId })
      if (error) return err('Billing settings could not be loaded')
      const parsed = parse(data)
      if (!parsed.ok || !parsed.value.subscription) return parsed
      try {
        const addOnResult = await addOnRequest
        if (!addOnResult || addOnResult.error || !Array.isArray(addOnResult.data)
          || addOnResult.data.some((addOn) => !RESTAURANT_ADD_ONS.includes(addOn as never))) {
          return parsed
        }
        return ok({
          ...parsed.value,
          subscription: {
            ...parsed.value.subscription,
            activeAddOns: addOnResult.data as SubscriptionBillingSettingsSubscription['activeAddOns'],
          },
        })
      } catch {
        // Additive projection: old deployments and isolated tests keep the
        // safe base billing response until the migration is available.
        return parsed
      }
    },
  }
}
