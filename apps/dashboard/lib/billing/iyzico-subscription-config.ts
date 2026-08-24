import {
  BILLING_INTERVALS,
  calculatePlanCharge,
  getPlanPrice,
  SELF_SERVE_PLANS,
  type BillingInterval,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'

const IYZICO_SUBSCRIPTION_SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const IYZICO_SUBSCRIPTION_LIVE_URL = 'https://api.iyzipay.com'

type BillingEnv = Readonly<Record<string, string | undefined>>
type ProviderPlan = { referenceCode: string; amountMinor: number }
export type ProviderAddOnPlan = ProviderPlan & { addOnNetAmountMinor: number }

export type IyzicoSubscriptionProviderConfig = {
  apiKey: string
  secretKey: string
  baseUrl: typeof IYZICO_SUBSCRIPTION_SANDBOX_URL | typeof IYZICO_SUBSCRIPTION_LIVE_URL
  vatRate: number
  plans: Record<SelfServePlan, Record<BillingInterval, ProviderPlan>>
  addOns?: {
    iyzico_online_payments: Record<BillingInterval, ProviderAddOnPlan> | null
  }
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

function vatRateEnv(env: BillingEnv): number {
  const rate = Number(requiredEnv(env, 'INVOICE_VAT_RATE'))
  if (!Number.isInteger(rate) || rate < 0 || rate > 100) {
    throw new Error('INVOICE_VAT_RATE must be an integer between 0 and 100')
  }
  return rate
}

function providerPlan(env: BillingEnv, plan: SelfServePlan, interval: BillingInterval, vatRate: number): ProviderPlan {
  const prefix = envPrefix(plan, interval)
  const amountMinor = amountEnv(env, `${prefix}_AMOUNT_MINOR`)
  const expected = calculatePlanCharge(getPlanPrice(plan, interval), vatRate).totalAmountMinor
  if (amountMinor !== expected) {
    throw new Error(`${prefix}_AMOUNT_MINOR does not match the canonical net price plus configured KDV`)
  }
  return {
    referenceCode: referenceEnv(env, `${prefix}_PLAN_REF`),
    amountMinor,
  }
}

function optionalIyzicoAddOnPlans(
  env: BillingEnv,
  vatRate: number,
): Record<BillingInterval, ProviderAddOnPlan> | null {
  const prefixes = {
    monthly: 'IYZICO_BILLING_PRO_IYZICO_ADDON_MONTHLY',
    annual: 'IYZICO_BILLING_PRO_IYZICO_ADDON_ANNUAL',
  } as const
  const names = BILLING_INTERVALS.flatMap((interval) => {
    const prefix = prefixes[interval]
    return [`${prefix}_PLAN_REF`, `${prefix}_ADDON_NET_AMOUNT_MINOR`, `${prefix}_AMOUNT_MINOR`]
  })
  const configured = names.filter((name) => Boolean(env[name]?.trim()))
  if (configured.length === 0) return null
  if (configured.length !== names.length) {
    throw new Error('IYZICO_BILLING_PRO_IYZICO_ADDON_* must be configured as one complete contract')
  }
  return Object.fromEntries(BILLING_INTERVALS.map((interval) => {
    const prefix = prefixes[interval]
    const addOnNetAmountMinor = amountEnv(env, `${prefix}_ADDON_NET_AMOUNT_MINOR`)
    const totalNetMinor = getPlanPrice('pro', interval).amountMinor + addOnNetAmountMinor
    const expectedGrossMinor = calculatePlanCharge({
      amountMinor: totalNetMinor,
      currency: 'TRY',
      vatIncluded: false,
    }, vatRate).totalAmountMinor
    const amountMinor = amountEnv(env, `${prefix}_AMOUNT_MINOR`)
    if (amountMinor !== expectedGrossMinor) {
      throw new Error(`${prefix}_AMOUNT_MINOR does not match Pro plus add-on net price and configured KDV`)
    }
    return [interval, {
      referenceCode: referenceEnv(env, `${prefix}_PLAN_REF`),
      addOnNetAmountMinor,
      amountMinor,
    }]
  })) as Record<BillingInterval, ProviderAddOnPlan>
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

  const vatRate = vatRateEnv(env)
  const plans = Object.fromEntries(SELF_SERVE_PLANS.map((plan) => [
    plan,
    Object.fromEntries(BILLING_INTERVALS.map((interval) => [
      interval,
      providerPlan(env, plan, interval, vatRate),
    ])) as Record<BillingInterval, ProviderPlan>,
  ])) as Record<SelfServePlan, Record<BillingInterval, ProviderPlan>>
  const iyzicoAddOnPlans = optionalIyzicoAddOnPlans(env, vatRate)

  const references = SELF_SERVE_PLANS.flatMap((plan) => (
    BILLING_INTERVALS.map((interval) => plans[plan][interval].referenceCode)
  )).concat(iyzicoAddOnPlans
    ? BILLING_INTERVALS.map((interval) => iyzicoAddOnPlans[interval].referenceCode)
    : [])
  if (new Set(references).size !== references.length) {
    throw new Error('IYZICO_BILLING_*_PLAN_REF values must be unique')
  }
  return {
    apiKey: requiredEnv(env, 'IYZICO_BILLING_API_KEY'),
    secretKey: requiredEnv(env, 'IYZICO_BILLING_SECRET_KEY'),
    baseUrl,
    vatRate,
    plans,
    addOns: { iyzico_online_payments: iyzicoAddOnPlans },
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
