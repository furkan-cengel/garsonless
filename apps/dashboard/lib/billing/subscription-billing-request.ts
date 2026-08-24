import { createHash } from 'node:crypto'
import type { SubscriptionBillingProfile } from '@garsonless/application/billing'
import type { BillingInterval, SelfServePlan } from '@garsonless/domain/entitlements'
import { getPlanPrice } from '@garsonless/domain/entitlements'
import { z } from 'zod'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { readIyzicoSubscriptionBillingRuntimeConfig } from './iyzico-subscription-config'

const paidPlanSchema = z.enum(['starter', 'plus', 'pro'])
const billingIntervalSchema = z.enum(['monthly', 'annual'])
export type PaidBillingPlan = SelfServePlan

const optionalText = (max: number) => z.string().trim().max(max).nullable()
const addressSchema = z.object({
  contactName: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  district: optionalText(100),
  country: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(500),
  zipCode: optionalText(20),
})

export const billingProfileSchema: z.ZodType<SubscriptionBillingProfile> = z.object({
  legalName: z.string().trim().min(1).max(200),
  taxOffice: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  surname: z.string().trim().min(1).max(100),
  identityNumber: z.string().trim().regex(/^\d{10,11}$/),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  gsmNumber: z.string().trim().transform((value) => value.replace(/[\s()-]/g, ''))
    .refine((value) => /^\+?[0-9]{10,15}$/.test(value)),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
})

export const checkoutRequestSchema = z.object({
  requestId: z.string().uuid(),
  plan: paidPlanSchema,
  interval: billingIntervalSchema,
  addOns: z.array(z.literal('iyzico_online_payments')).max(1).default([]),
  profile: billingProfileSchema,
  checkoutTermsAccepted: z.literal(true),
  legalDocumentVersion: z.literal(LEGAL_DOCUMENT_VERSION),
}).strict().superRefine((value, context) => {
  if (value.addOns.length > 0 && value.plan !== 'pro') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['addOns'],
      message: 'İyzico online payment add-on is available only with Pro',
    })
  }
})

export const retryRequestSchema = z.object({
  requestId: z.string().uuid(),
  invoiceId: z.string().uuid(),
})

export const cancellationRequestSchema = z.object({
  requestId: z.string().uuid(),
  currentPassword: z.string().min(1).max(256),
}).strict()

export type BillingPlanPrices = Record<PaidBillingPlan, Record<BillingInterval, number | null>> & {
  iyzicoOnlinePaymentsAddOn: Record<BillingInterval, number | null>
}

/** Public display prices only. Provider plan references and credentials remain
 * server-side; an incomplete checkout/webhook contract renders every paid plan
 * unavailable so the UI cannot advertise an unusable billing path. */
export function readBillingPlanPrices(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BillingPlanPrices {
  try {
    const config = readIyzicoSubscriptionBillingRuntimeConfig(env)
    return {
      starter: {
        monthly: getPlanPrice('starter', 'monthly').amountMinor,
        annual: getPlanPrice('starter', 'annual').amountMinor,
      },
      plus: {
        monthly: getPlanPrice('plus', 'monthly').amountMinor,
        annual: getPlanPrice('plus', 'annual').amountMinor,
      },
      pro: {
        monthly: getPlanPrice('pro', 'monthly').amountMinor,
        annual: getPlanPrice('pro', 'annual').amountMinor,
      },
      iyzicoOnlinePaymentsAddOn: {
        monthly: config.provider.addOns?.iyzico_online_payments?.monthly.addOnNetAmountMinor ?? null,
        annual: config.provider.addOns?.iyzico_online_payments?.annual.addOnNetAmountMinor ?? null,
      },
    }
  } catch {
    return {
      starter: { monthly: null, annual: null },
      plus: { monthly: null, annual: null },
      pro: { monthly: null, annual: null },
      iyzicoOnlinePaymentsAddOn: { monthly: null, annual: null },
    }
  }
}

export function requestFingerprint(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function billingPeriod(now: Date, interval: BillingInterval): {
  periodStart: string
  periodEnd: string
  dueAt: string
} {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid billing clock')
  const end = new Date(now)
  const originalDay = end.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + (interval === 'annual' ? 12 : 1))
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(originalDay, lastDay))
  return {
    periodStart: now.toISOString(),
    periodEnd: end.toISOString(),
    dueAt: now.toISOString(),
  }
}

export function billingDashboardUrl(
  path: string,
  baseUrl: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): URL {
  const fallback = nodeEnv === 'production' ? null : 'http://localhost:3000'
  const configured = baseUrl?.trim() || fallback
  if (!configured) throw new Error('Dashboard callback origin is required')
  const base = new URL(configured)
  const local = nodeEnv !== 'production' && base.protocol === 'http:'
    && ['localhost', '127.0.0.1'].includes(base.hostname)
  if ((base.protocol !== 'https:' && !local) || base.username || base.password
    || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('Dashboard callback origin is invalid')
  }
  return new URL(path, base)
}

export function billingCheckoutCallbackUrl(baseUrl: string | undefined): string {
  return billingDashboardUrl('/api/billing/iyzico/checkout/callback', baseUrl).toString()
}
