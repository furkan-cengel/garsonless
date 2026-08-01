'use server'

import {
  cancelTenantSubscription,
  retrySubscriptionInvoice,
  saveSubscriptionBillingProfile,
  startSubscriptionCheckout,
} from '@garsonless/application/billing'
import { createSubscriptionBillingOperationsPort } from '@garsonless/db/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '../auth/access'
import {
  createIyzicoSubscriptionBillingProvider,
  readIyzicoSubscriptionProviderConfig,
} from '../billing/iyzico-subscription-provider'
import {
  billingCheckoutCallbackUrl,
  billingPeriod,
  billingProfileSchema,
  cancellationRequestSchema,
  checkoutRequestSchema,
  requestFingerprint,
  retryRequestSchema,
} from '../billing/subscription-billing-request'
import {
  dashboardAccessFailure,
  dashboardActionFailure,
  type DashboardActionFailure,
} from '../server-action-error'

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

function billingFailure(error: string, operation: string): DashboardActionFailure {
  const normalized = error.toLowerCase()
  if (normalized.includes('owner context')) {
    return dashboardActionFailure('ACCESS_DENIED', { operation })
  }
  if (normalized.includes('invalid') || normalized.includes('required')) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation })
  }
  if (normalized.includes('in progress') || normalized.includes('idempotency') || normalized.includes('conflict')) {
    return dashboardActionFailure('CONFLICT', { operation })
  }
  if (normalized.includes('not active') || normalized.includes('payment')) {
    return dashboardActionFailure('PAYMENT_ACTION_REQUIRED', { operation })
  }
  return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation, cause: error })
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
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.profile.save' })
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
  duplicate: boolean
} | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.checkout.start')
  if (!gate.ok) return gate.failure
  const parsed = checkoutRequestSchema.safeParse(input)
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.checkout.start' })
  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const intent = {
      operation: 'checkout.initialize', restaurantId: gate.restaurantId,
      plan: parsed.data.plan, profile: parsed.data.profile,
      providerPlanRef: config.plans[parsed.data.plan].referenceCode,
    }
    const result = await startSubscriptionCheckout(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        profile: parsed.data.profile,
        plan: parsed.data.plan,
        amount: { minor: config.plans[parsed.data.plan].amountMinor, currency: 'TRY' },
        expectedProviderPlanRef: config.plans[parsed.data.plan].referenceCode,
        ...billingPeriod(new Date()),
        callbackUrl: billingCheckoutCallbackUrl(process.env['NEXT_PUBLIC_APP_URL']),
        idempotencyKey: `billing:checkout:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint(intent),
      },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    return result.ok ? { success: true, ...result.value } : billingFailure(result.error, 'billing.checkout.start')
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.checkout.start', cause })
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

export async function cancelBillingSubscriptionAction(
  restaurantId: string,
  input: unknown,
): Promise<{ success: true; subscriptionId: string; duplicate: boolean } | DashboardActionFailure> {
  const gate = await ownerGate(restaurantId, 'billing.subscription.cancel')
  if (!gate.ok) return gate.failure
  const parsed = cancellationRequestSchema.safeParse(input)
  if (!parsed.success) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'billing.subscription.cancel' })
  try {
    const config = readIyzicoSubscriptionProviderConfig()
    const result = await cancelTenantSubscription(
      actor(gate.restaurantId, gate.userId),
      {
        restaurantId: gate.restaurantId,
        idempotencyKey: `billing:cancel:${gate.restaurantId}:${parsed.data.requestId}`,
        requestFingerprint: requestFingerprint({
          operation: 'subscription.cancel', restaurantId: gate.restaurantId,
        }),
      },
      createSubscriptionBillingOperationsPort(),
      createIyzicoSubscriptionBillingProvider(config),
    )
    if (!result.ok) return billingFailure(result.error, 'billing.subscription.cancel')
    revalidatePath(`/dashboard/${gate.restaurantId}/settings`)
    return { success: true, ...result.value }
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'billing.subscription.cancel', cause })
  }
}
