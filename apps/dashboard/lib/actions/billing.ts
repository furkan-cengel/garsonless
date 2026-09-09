'use server'

import { createHash, createHmac } from 'node:crypto'

import {
  recoverSubscriptionCheckout,
  retrySubscriptionInvoice,
  saveSubscriptionBillingProfile,
  scheduleTenantSubscriptionCancellation,
  scheduleSubscriptionPlanChange,
  startSubscriptionCardUpdate,
  startSubscriptionCheckout,
  withdrawTenantSubscriptionCancellation,
} from '@garsonless/application/billing'
import {
  createSubscriptionCancellationSchedulePort,
  createSubscriptionBillingOperationsPort,
  recordLegalDocumentAcceptance,
} from '@garsonless/db/server'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { getAddOnPrice, getPlanPrice } from '@garsonless/domain/entitlements'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '../auth/access'
import {
  createIyzicoSubscriptionBillingProvider,
  assertIyzicoSubscriptionSalesEnabled,
  providerPlanForSelection,
  readIyzicoSubscriptionProviderConfig,
} from '../billing/iyzico-subscription-provider'
import {
  billingCheckoutCallbackUrl,
  billingCardUpdateCallbackUrl,
  billingPeriod,
  billingProfileSchema,
  billingValidationMessage,
  cardUpdateRequestSchema,
  cancellationRequestSchema,
  cancellationWithdrawalRequestSchema,
  checkoutRequestSchema,
  requestFingerprint,
  planChangeRequestSchema,
  retryRequestSchema,
} from '../billing/subscription-billing-request'
import {
  dashboardAccessFailure,
  dashboardActionFailure,
  type DashboardActionFailure,
} from '../server-action-error'
import { requireFreshOwnerPassword } from '../auth/fresh-owner-auth'
import { BILLING_PHONE_GUIDANCE, INVALID_BILLING_PHONE } from '../billing/billing-phone'

const restaurantIdSchema = z.string().uuid()

function actor(restaurantId: string, userId: string) {
  return {
    actor: 'dashboard-member' as const,
    restaurantId,
    userId,
    permissions: ['settings'],
    isOwner: true,
  }
}

function billingFailure(
  error: string,
  operation: string,
  diagnostic: Readonly<Record<string, string | number | boolean>> = {},
): DashboardActionFailure {
  const normalized = error.toLowerCase()
  const cause = { error, ...diagnostic }
  if (error === INVALID_BILLING_PHONE) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation, cause, message: BILLING_PHONE_GUIDANCE })
  }
  if (normalized.includes('owner context')) {
    return dashboardActionFailure('ACCESS_DENIED', { operation, cause })
  }
  if (normalized.includes('invalid') || normalized.includes('required')) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation, cause })
  }
  if (normalized.includes('in progress') || normalized.includes('idempotency') || normalized.includes('conflict')) {
    return dashboardActionFailure('CONFLICT', { operation, cause })
  }
  if (normalized.includes('not active') || normalized.includes('payment')) {
    return dashboardActionFailure('PAYMENT_ACTION_REQUIRED', { operation, cause })
  }
  return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation, cause })
}

function billingSchemaFailure(error: z.ZodError, operation: string): DashboardActionFailure {
  const issues = error.issues.map((issue) => ({ path: issue.path, code: issue.code }))
  return dashboardActionFailure('VALIDATION_FAILED', {
    operation,
    message: billingValidationMessage(issues),
    cause: { issues },
  })
}

async function ownerGate(restaurantId: unknown, operation: string) {
  const parsed = restaurantIdSchema.safeParse(restaurantId)
  if (!parsed.success) {
    return { ok: false as const, failure: dashboardActionFailure('VALIDATION_FAILED', { operation }) }
  }
  const gate = await assertOwner(parsed.data)
  if ('error' in gate) {
    return { ok: false as const, failure: dashboardAccessFailure(gate.error, operation) }
  }
  return { ok: true as const, restaurantId: parsed.data, userId: gate.userId }
}

export async function saveBillingProfileAction(
  restaurantId: string,
  input: unknown,
): Promise<{ success: true; customerId: string } | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.profile.save')
  if (!gate.ok) return gate.failure
  const parsed = billingProfileSchema.safeParse(input)
  if (!parsed.success) return billingSchemaFailure(parsed.error, 'billing.profile.save')
  try {
    const result = await saveSubscriptionBillingProfile(
      actor(gate.restaurantId, gate.userId),
      { restaurantId: gate.restaurantId, profile: parsed.data },
      createSubscriptionBillingOperationsPort(),
    )
    return result.ok
      ? { success: true, customerId: result.value.customerId }
      : billingFailure(result.error, 'billing.profile.save')
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.profile.save', cause })
  }
}

export async function startBillingCheckoutAction(
  restaurantId: string,
  input: unknown,
): Promise<{
  success: true
  operationId: string
  providerCheckoutRef: string
  checkoutContent: string | null
  expiresAt: string | null
  duplicate: boolean
} | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.checkout.start')
  if (!gate.ok) return gate.failure
  const parsed = checkoutRequestSchema.safeParse(input)
  if (!parsed.success) return billingSchemaFailure(parsed.error, 'billing.checkout.start')
  try {
    assertIyzicoSubscriptionSalesEnabled()
    const config = readIyzicoSubscriptionProviderConfig()
    const selectedAddOn = parsed.data.addOns[0] ?? null
    const providerPlan = providerPlanForSelection(
      config, parsed.data.plan, parsed.data.interval, parsed.data.addOns,
    )
    if (!providerPlan) {
      return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.checkout.add-on-unavailable' })
    }
    const planNetAmountMinor = getPlanPrice(parsed.data.plan, parsed.data.interval).amountMinor
    const addOnNetAmountMinor = selectedAddOn
      ? getAddOnPrice(selectedAddOn, parsed.data.interval).amountMinor
      : 0
    const netAmountMinor = planNetAmountMinor + addOnNetAmountMinor
    const acceptance = await recordLegalDocumentAcceptance({
      userId: gate.userId,
      documentType: 'checkout_summary_accepted',
      documentVersion: LEGAL_DOCUMENT_VERSION,
      occurredAt: new Date().toISOString(),
      ipHash: null,
      userAgent: null,
      evidenceKey: parsed.data.requestId,
      documentContext: {
        plan: parsed.data.plan, interval: parsed.data.interval,
        netAmountMinor,
        lineItems: [
          { type: 'plan', code: parsed.data.plan, amountMinor: planNetAmountMinor },
          ...(selectedAddOn ? [{
            type: 'add_on', code: selectedAddOn, amountMinor: addOnNetAmountMinor,
          }] : []),
        ],
        vatRate: config.vatRate,
        vatAmountMinor: providerPlan.amountMinor - netAmountMinor,
        totalAmountMinor: providerPlan.amountMinor,
        currency: 'TRY', kdvIncluded: false,
        customer: {
          legalName: parsed.data.profile.legalName,
          identityNumber: parsed.data.profile.identityNumber,
          taxOffice: parsed.data.profile.taxOffice,
          email: parsed.data.profile.email,
          billingAddress: parsed.data.profile.billingAddress,
        },
      },
    })
    if (!acceptance.ok) return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.checkout.legal-evidence' })
    const intent = {
      operation: 'checkout.initialize', restaurantId: gate.restaurantId,
      plan: parsed.data.plan, interval: parsed.data.interval, profile: parsed.data.profile,
      addOns: parsed.data.addOns,
      providerPlanRef: providerPlan.referenceCode,
    }
    const result = await startSubscriptionCheckout(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        profile: parsed.data.profile,
        plan: parsed.data.plan,
        addOns: parsed.data.addOns,
        interval: parsed.data.interval,
        amount: { minor: providerPlan.amountMinor, currency: 'TRY' },
        expectedProviderPlanRef: providerPlan.referenceCode,
        ...billingPeriod(new Date(), parsed.data.interval),
        callbackUrl: billingCheckoutCallbackUrl(process.env['NEXT_PUBLIC_APP_URL']),
        idempotencyKey: `billing:checkout:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint(intent),
      },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    return result.ok ? { success: true, ...result.value } : billingFailure(
      result.error,
      'billing.checkout.start',
      {
        plan: parsed.data.plan,
        interval: parsed.data.interval,
        amountMinor: providerPlan.amountMinor,
        idempotencyKeyLength: `billing:checkout:${gate.restaurantId}:${parsed.data.requestId}`.length,
      },
    )
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.checkout.start', cause })
  }
}

export async function checkSubscriptionCheckoutAction(
  restaurantId: string,
  operationId: string,
): Promise<{
  success: true
  outcome: 'active' | 'incomplete' | 'expired' | 'ambiguous'
  duplicate?: boolean
} | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.checkout.check')
  if (!gate.ok) return gate.failure
  const parsedOperationId = z.string().uuid().safeParse(operationId)
  if (!parsedOperationId.success) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.checkout.check' })
  }
  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const result = await recoverSubscriptionCheckout(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        operationId: parsedOperationId.data,
        workerId: `dashboard-${crypto.randomUUID()}`,
      },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    if (!result.ok) {
      const normalized = result.error.toLowerCase()
      if (normalized.includes('busy') || normalized.includes('not pending') || normalized.includes('lease')) {
        return { success: true, outcome: 'ambiguous' }
      }
      return billingFailure(result.error, 'billing.checkout.check')
    }
    if (result.value.outcome === 'active') {
      revalidatePath(`/dashboard/${gate.restaurantId}/settings`)
      return { success: true, outcome: 'active', duplicate: result.value.duplicate }
    }
    return { success: true, outcome: result.value.outcome }
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.checkout.check', cause })
  }
}

export async function retryBillingInvoiceAction(
  restaurantId: string,
  input: unknown,
): Promise<{ success: true; accepted: true; duplicate: boolean } | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.invoice.retry')
  if (!gate.ok) return gate.failure
  const parsed = retryRequestSchema.safeParse(input)
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.invoice.retry' })
  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const result = await retrySubscriptionInvoice(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        invoiceId: parsed.data.invoiceId,
        idempotencyKey: `billing:retry:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint({
          operation: 'payment.retry', restaurantId: gate.restaurantId, invoiceId: parsed.data.invoiceId,
        }),
      },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    return result.ok ? { success: true, ...result.value } : billingFailure(result.error, 'billing.invoice.retry')
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.invoice.retry', cause })
  }
}

export async function startBillingCardUpdateAction(
  restaurantId: string,
  input: unknown,
): Promise<{
  success: true
  operationId: string
  providerCheckoutRef: string | null
  checkoutContent: string | null
  expiresAt: string | null
  duplicate: boolean
} | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.card-update.start')
  if (!gate.ok) return gate.failure
  const parsed = cardUpdateRequestSchema.safeParse(input)
  if (!parsed.success) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.card-update.start' })
  }
  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const callbackState = createHmac('sha256', config.secretKey)
      .update(`masabu:billing-card-update:v1\n${gate.restaurantId}\n${parsed.data.requestId}`)
      .digest('base64url')
    const callbackStateHash = createHash('sha256').update(callbackState).digest('hex')
    const result = await startSubscriptionCardUpdate(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        callbackUrl: billingCardUpdateCallbackUrl(
          process.env['NEXT_PUBLIC_APP_URL'],
          callbackState,
        ),
        callbackStateHash,
        idempotencyKey: `billing:card-update:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint({
          operation: 'card_update.initialize',
          restaurantId: gate.restaurantId,
          requestId: parsed.data.requestId,
          callbackStateHash,
        }),
      },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    if (result.ok) return { success: true, ...result.value }
    if (result.error.toLowerCase().includes('already in progress')) {
      return dashboardActionFailure('PAYMENT_ACTION_REQUIRED', {
        operation: 'billing.card-update.start',
        message: 'Kart güncelleme sonucu kontrol ediliyor. Aynı işlemi tekrar başlatmayın.',
      })
    }
    return billingFailure(result.error, 'billing.card-update.start')
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.card-update.start', cause })
  }
}

export async function scheduleBillingPlanChangeAction(
  restaurantId: string,
  input: unknown,
): Promise<{
  success: true
  changeRequestId: string
  subscriptionId: string
  status: 'scheduled'
  effectiveAt: string
  duplicate: boolean
} | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.plan-change.schedule')
  if (!gate.ok) return gate.failure
  const parsed = planChangeRequestSchema.safeParse(input)
  if (!parsed.success) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.plan-change.schedule' })
  }
  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const providerPlan = providerPlanForSelection(
      config, parsed.data.toPlan, parsed.data.billingInterval, parsed.data.addOns,
    )
    if (!providerPlan) {
      return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.plan-change.unavailable' })
    }
    const intent = {
      operation: 'subscription.change', restaurantId: gate.restaurantId,
      toPlan: parsed.data.toPlan, billingInterval: parsed.data.billingInterval,
      addOns: parsed.data.addOns, providerTargetPlanRef: providerPlan.referenceCode,
      effectivePolicy: 'next_period',
    }
    const result = await scheduleSubscriptionPlanChange(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        toPlan: parsed.data.toPlan,
        toAddOns: parsed.data.addOns,
        toBillingInterval: parsed.data.billingInterval,
        providerTargetPlanRef: providerPlan.referenceCode,
        effectivePolicy: 'next_period',
        idempotencyKey: `billing:plan-change:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint(intent),
      },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    if (!result.ok) return billingFailure(result.error, 'billing.plan-change.schedule')
    revalidatePath(`/dashboard/${gate.restaurantId}/settings`)
    return { success: true, ...result.value }
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.plan-change.schedule', cause })
  }
}

export async function cancelBillingSubscriptionAction(
  restaurantId: string,
  input: unknown,
): Promise<{
  success: true
  cancellationRequestId: string
  subscriptionId: string
  status: 'scheduled'
  effectiveAt: string
  duplicate: boolean
} | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.subscription.cancel')
  if (!gate.ok) return gate.failure
  const parsed = cancellationRequestSchema.safeParse(input)
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.subscription.cancel' })
  const freshAuth = await requireFreshOwnerPassword(gate.restaurantId, parsed.data.currentPassword)
  if (!freshAuth.ok) {
    return dashboardActionFailure('AUTH_REQUIRED', {
      operation: 'billing.subscription.cancel',
      message: freshAuth.error,
    })
  }
  try {
    const result = await scheduleTenantSubscriptionCancellation(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        idempotencyKey: `billing:cancellation-schedule:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint({
          operation: 'subscription.cancellation.schedule', restaurantId: gate.restaurantId,
        }),
      },
      createSubscriptionCancellationSchedulePort(),
    )
    if (!result.ok) return billingFailure(result.error, 'billing.subscription.cancel')
    revalidatePath(`/dashboard/${gate.restaurantId}/settings`)
    return { success: true, ...result.value }
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.subscription.cancel', cause })
  }
}

export async function undoBillingSubscriptionCancellationAction(
  restaurantId: string,
  input: unknown,
): Promise<{
  success: true
  cancellationRequestId: string
  subscriptionId: string
  status: 'withdrawn'
  duplicate: boolean
} | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.subscription.cancel.withdraw')
  if (!gate.ok) return gate.failure
  const parsed = cancellationWithdrawalRequestSchema.safeParse(input)
  if (!parsed.success) {
    return dashboardActionFailure('VALIDATION_FAILED', {
      operation: 'billing.subscription.cancel.withdraw',
    })
  }
  try {
    const result = await withdrawTenantSubscriptionCancellation(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        cancellationRequestId: parsed.data.cancellationRequestId,
        idempotencyKey: `billing:cancellation-withdraw:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint({
          operation: 'subscription.cancellation.withdraw',
          restaurantId: gate.restaurantId,
          cancellationRequestId: parsed.data.cancellationRequestId,
        }),
      },
      createSubscriptionCancellationSchedulePort(),
    )
    if (!result.ok) return billingFailure(result.error, 'billing.subscription.cancel.withdraw')
    revalidatePath(`/dashboard/${gate.restaurantId}/settings`)
    return { success: true, ...result.value }
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'billing.subscription.cancel.withdraw', cause,
    })
  }
}
