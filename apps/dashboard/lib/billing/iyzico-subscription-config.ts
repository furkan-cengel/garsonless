import {
  BILLING_INTERVALS,
  getPlanPrice,
  SELF_SERVE_PLANS,
  type BillingInterval,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'

const IYZICO_SUBSCRIPTION_SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const IYZICO_SUBSCRIPTION_LIVE_URL = 'https://api.iyzipay.com'

type BillingEnv = Readonly<Record<string, string | undefined>>
type ProviderPlan = { referenceCode: string; amountMinor: number }

export type IyzicoSubscriptionProviderConfig = {
  apiKey: string
  secretKey: string
  baseUrl: typeof IYZICO_SUBSCRIPTION_SANDBOX_URL | typeof IYZICO_SUBSCRIPTION_LIVE_URL
  plans: Record<SelfServePlan, Record<BillingInterval, ProviderPlan>>
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
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive TRY minor-unit integer`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a positive TRY minor-unit integer`)
  return value
}

function envPrefix(plan: SelfServePlan, interval: BillingInterval): string {
  return `IYZICO_BILLING_${plan.toUpperCase()}_${interval.toUpperCase()}`
}

function providerPlan(env: BillingEnv, plan: SelfServePlan, interval: BillingInterval): ProviderPlan {
  const prefix = envPrefix(plan, interval)
  const amountMinor = amountEnv(env, `${prefix}_AMOUNT_MINOR`)
  if (amountMinor !== getPlanPrice(plan, interval).amountMinor) {
    throw new Error(`${prefix}_AMOUNT_MINOR does not match the canonical KDV-included catalogue price`)
  }
  return {
    referenceCode: referenceEnv(env, `${prefix}_PLAN_REF`),
    amountMinor,
  }
}

/** Six immutable provider variants: Starter/Plus/Pro × monthly/annual. */
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

  const plans = Object.fromEntries(SELF_SERVE_PLANS.map((plan) => [
    plan,
    Object.fromEntries(BILLING_INTERVALS.map((interval) => [
      interval,
      providerPlan(env, plan, interval),
    ])) as Record<BillingInterval, ProviderPlan>,
  ])) as Record<SelfServePlan, Record<BillingInterval, ProviderPlan>>

  const references = SELF_SERVE_PLANS.flatMap((plan) => (
    BILLING_INTERVALS.map((interval) => plans[plan][interval].referenceCode)
  ))
  if (new Set(references).size !== references.length) {
    throw new Error('IYZICO_BILLING_*_PLAN_REF values must be unique')
  }
  return {
    apiKey: requiredEnv(env, 'IYZICO_BILLING_API_KEY'),
    secretKey: requiredEnv(env, 'IYZICO_BILLING_SECRET_KEY'),
    baseUrl,
    plans,
  }
}

export function readIyzicoSubscriptionWebhookConfig(
  env: BillingEnv = process.env,
): IyzicoSubscriptionWebhookConfig {
  return {
    merchantId: referenceEnv(env, 'IYZICO_BILLING_MERCHANT_ID'),
    secretKey: requiredEnv(env, 'IYZICO_BILLING_SECRET_KEY'),
  }
}

export function readIyzicoSubscriptionBillingRuntimeConfig(env: BillingEnv = process.env) {
  return {
    provider: readIyzicoSubscriptionProviderConfig(env),
    webhook: readIyzicoSubscriptionWebhookConfig(env),
  }
}
