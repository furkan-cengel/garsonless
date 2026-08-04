import type { RestaurantPlan } from '@garsonless/domain/entitlements'

const IYZICO_SUBSCRIPTION_SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const IYZICO_SUBSCRIPTION_LIVE_URL = 'https://api.iyzipay.com'

type PaidPlan = Exclude<RestaurantPlan, 'free'>
type BillingEnv = Readonly<Record<string, string | undefined>>

export type IyzicoSubscriptionProviderConfig = {
  apiKey: string
  secretKey: string
  baseUrl: typeof IYZICO_SUBSCRIPTION_SANDBOX_URL | typeof IYZICO_SUBSCRIPTION_LIVE_URL
  plans: Record<PaidPlan, { referenceCode: string; amountMinor: number }>
}

export type IyzicoSubscriptionWebhookConfig = {
  merchantId: string
  secretKey: string
}

function requiredEnv(env: BillingEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required for SaaS subscription billing`)
  return value
}

function referenceEnv(env: BillingEnv, name: string): string {
  const value = requiredEnv(env, name)
  if (!/^[\x21-\x7e]{1,200}$/.test(value)) {
    throw new Error(`${name} must be a printable provider reference of at most 200 characters`)
  }
  return value
}

function amountEnv(env: BillingEnv, name: string): number {
  const raw = requiredEnv(env, name)
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive TRY minor-unit integer`)
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a positive TRY minor-unit integer`)
  }
  return value
}

/** Platform credentials are deliberately explicit. There is no fallback to
 * the per-restaurant order-payment IYZICO_* configuration. */
export function readIyzicoSubscriptionProviderConfig(
  env: BillingEnv = process.env,
): IyzicoSubscriptionProviderConfig {
  if (env.SAAS_BILLING_ENABLED?.trim() !== 'true') {
    throw new Error('SAAS_BILLING_ENABLED must be true for provider operations')
  }
  const baseUrl = requiredEnv(env, 'IYZICO_BILLING_BASE_URL')
  if (baseUrl !== IYZICO_SUBSCRIPTION_SANDBOX_URL && baseUrl !== IYZICO_SUBSCRIPTION_LIVE_URL) {
    throw new Error('IYZICO_BILLING_BASE_URL must be an approved iyzico API origin')
  }
  if (env.NODE_ENV === 'production' && baseUrl !== IYZICO_SUBSCRIPTION_LIVE_URL) {
    throw new Error('IYZICO_BILLING_BASE_URL must use the live origin in production')
  }
  const plans = {
    starter: {
      referenceCode: referenceEnv(env, 'IYZICO_BILLING_STARTER_PLAN_REF'),
      amountMinor: amountEnv(env, 'IYZICO_BILLING_STARTER_AMOUNT_MINOR'),
    },
    pro: {
      referenceCode: referenceEnv(env, 'IYZICO_BILLING_PRO_PLAN_REF'),
      amountMinor: amountEnv(env, 'IYZICO_BILLING_PRO_AMOUNT_MINOR'),
    },
    enterprise: {
      referenceCode: referenceEnv(env, 'IYZICO_BILLING_ENTERPRISE_PLAN_REF'),
      amountMinor: amountEnv(env, 'IYZICO_BILLING_ENTERPRISE_AMOUNT_MINOR'),
    },
  }
  if (new Set(Object.values(plans).map((plan) => plan.referenceCode)).size !== 3) {
    throw new Error('IYZICO_BILLING_*_PLAN_REF values must be unique')
  }
  return {
    apiKey: requiredEnv(env, 'IYZICO_BILLING_API_KEY'),
    secretKey: requiredEnv(env, 'IYZICO_BILLING_SECRET_KEY'),
    baseUrl,
    plans,
  }
}

/** Webhook verification deliberately has a smaller availability boundary:
 * existing subscriptions can still deliver events while checkout is paused. */
export function readIyzicoSubscriptionWebhookConfig(
  env: BillingEnv = process.env,
): IyzicoSubscriptionWebhookConfig {
  return {
    merchantId: referenceEnv(env, 'IYZICO_BILLING_MERCHANT_ID'),
    secretKey: requiredEnv(env, 'IYZICO_BILLING_SECRET_KEY'),
  }
}

/** Used by the settings projection to expose prices only when both checkout
 * and webhook processing are configured. It returns no credentials. */
export function readIyzicoSubscriptionBillingRuntimeConfig(env: BillingEnv = process.env) {
  return {
    provider: readIyzicoSubscriptionProviderConfig(env),
    webhook: readIyzicoSubscriptionWebhookConfig(env),
  }
}
