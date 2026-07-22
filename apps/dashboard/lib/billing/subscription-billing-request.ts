import { createHash } from 'node:crypto'
import type { SubscriptionBillingProfile } from '@garsonless/application/billing'
import type { RestaurantPlan } from '@garsonless/domain/entitlements'
import { z } from 'zod'

export const paidPlanSchema = z.enum(['starter', 'pro', 'enterprise'])
export type PaidBillingPlan = Exclude<RestaurantPlan, 'free'>

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
  profile: billingProfileSchema,
})

export const retryRequestSchema = z.object({
  requestId: z.string().uuid(),
  invoiceId: z.string().uuid(),
})

export const cancellationRequestSchema = z.object({ requestId: z.string().uuid() })

export type BillingPlanPrices = Record<PaidBillingPlan, number | null>

/** Public display prices only. Provider plan references and credentials remain
 * in the provider config; an invalid/missing amount renders as unavailable. */
export function readBillingPlanPrices(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BillingPlanPrices {
  const amount = (name: string): number | null => {
    const value = Number(env[name])
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }
  return {
    starter: amount('IYZICO_BILLING_STARTER_AMOUNT_MINOR'),
    pro: amount('IYZICO_BILLING_PRO_AMOUNT_MINOR'),
    enterprise: amount('IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR'),
  }
}

export function requestFingerprint(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function billingPeriod(now: Date): {
  periodStart: string
  periodEnd: string
  dueAt: string
} {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid billing clock')
  const end = new Date(now)
  const originalDay = end.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(originalDay, lastDay))
  return {
    periodStart: now.toISOString(),
    periodEnd: end.toISOString(),
    dueAt: now.toISOString(),
  }
}

export function billingCheckoutCallbackUrl(baseUrl: string | undefined): string {
  const url = new URL('/api/billing/iyzico/checkout/callback', baseUrl ?? 'http://localhost:3000')
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !local) throw new Error('Dashboard callback origin is invalid')
  return url.toString()
}
