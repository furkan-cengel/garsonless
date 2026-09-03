import {
  BILLING_INTERVALS,
  ADD_ON_DEFINITIONS,
  calculatePlanCharge,
  getAddOnPrice,
  getPlanPrice,
  isValidAddOnSelection,
  RESTAURANT_ADD_ONS,
  SELF_SERVE_PLANS,
  type BillingInterval,
  type RestaurantAddOn,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'

const IYZICO_SUBSCRIPTION_SANDBOX_URL = 'https://sandbox-api.iyzipay.com'
const IYZICO_SUBSCRIPTION_LIVE_URL = 'https://api.iyzipay.com'

type BillingEnv = Readonly<Record<string, string | undefined>>
type ProviderPlan = { referenceCode: string; amountMinor: number }
export type ProviderAddOnPlan = ProviderPlan & { addOnNetAmountMinor: number }
export type ProviderAddOnPlanGroup = Partial<
  Record<SelfServePlan, Record<BillingInterval, ProviderAddOnPlan>>
>

export type IyzicoSubscriptionProviderConfig = {
  apiKey: string
  secretKey: string
  baseUrl: typeof IYZICO_SUBSCRIPTION_SANDBOX_URL | typeof IYZICO_SUBSCRIPTION_LIVE_URL
  vatRate: number
  plans: Record<SelfServePlan, Record<BillingInterval, ProviderPlan>>
  addOns: Record<RestaurantAddOn, ProviderAddOnPlanGroup | null>
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

const ADD_ON_ENV_SLUG: Readonly<Record<RestaurantAddOn, string>> = {
  iyzico_online_payments: 'IYZICO_ADDON',
  storefront_video_hero: 'VIDEO_HERO',
}

export function providerAddOnEnvPrefix(plan: SelfServePlan, addOn: RestaurantAddOn): string {
  return `IYZICO_BILLING_${plan.toUpperCase()}_${ADD_ON_ENV_SLUG[addOn]}`
}

const ADD_ON_PROVIDER_VARIANTS: Readonly<Record<RestaurantAddOn, readonly {
  plan: SelfServePlan
  prefix: string
}[]>> = Object.fromEntries(RESTAURANT_ADD_ONS.map((addOn) => [
  addOn,
  ADD_ON_DEFINITIONS[addOn].availableOn
    .filter((plan): plan is SelfServePlan => SELF_SERVE_PLANS.includes(plan as SelfServePlan))
    .map((plan) => ({ plan, prefix: providerAddOnEnvPrefix(plan, addOn) })),
])) as Record<RestaurantAddOn, { plan: SelfServePlan; prefix: string }[]>

function optionalAddOnPlanGroup(
  env: BillingEnv,
  vatRate: number,
  addOn: RestaurantAddOn,
): ProviderAddOnPlanGroup | null {
  const variants = ADD_ON_PROVIDER_VARIANTS[addOn]
  const names = variants.flatMap(({ prefix }) => BILLING_INTERVALS.flatMap((interval) => {
    const intervalPrefix = `${prefix}_${interval.toUpperCase()}`
    return [`${intervalPrefix}_PLAN_REF`, `${intervalPrefix}_ADDON_NET_AMOUNT_MINOR`, `${intervalPrefix}_AMOUNT_MINOR`]
  }))
  const configured = names.filter((name) => Boolean(env[name]?.trim()))
  if (configured.length === 0) return null
  if (configured.length !== names.length) {
    throw new Error(`${addOn} provider variants must be configured as one complete contract`)
  }
  return Object.fromEntries(variants.map(({ plan, prefix }) => [
    plan,
    Object.fromEntries(BILLING_INTERVALS.map((interval) => {
      const intervalPrefix = `${prefix}_${interval.toUpperCase()}`
      const addOnNetAmountMinor = amountEnv(env, `${intervalPrefix}_ADDON_NET_AMOUNT_MINOR`)
      const expectedAddOnNetMinor = getAddOnPrice(addOn, interval).amountMinor
      if (addOnNetAmountMinor !== expectedAddOnNetMinor) {
        throw new Error(`${intervalPrefix}_ADDON_NET_AMOUNT_MINOR does not match the canonical add-on price`)
      }
      const totalNetMinor = getPlanPrice(plan, interval).amountMinor + addOnNetAmountMinor
      const expectedGrossMinor = calculatePlanCharge({
        amountMinor: totalNetMinor, currency: 'TRY', vatIncluded: false,
      }, vatRate).totalAmountMinor
      const amountMinor = amountEnv(env, `${intervalPrefix}_AMOUNT_MINOR`)
      if (amountMinor !== expectedGrossMinor) {
        throw new Error(`${intervalPrefix}_AMOUNT_MINOR does not match the plan plus add-on net price and configured KDV`)
      }
      return [interval, {
        referenceCode: referenceEnv(env, `${intervalPrefix}_PLAN_REF`),
        addOnNetAmountMinor, amountMinor,
      }]
    })) as Record<BillingInterval, ProviderAddOnPlan>,
  ])) as ProviderAddOnPlanGroup
}

export function providerPlanForSelection(
  config: IyzicoSubscriptionProviderConfig,
  plan: SelfServePlan,
  interval: BillingInterval,
  addOns: readonly RestaurantAddOn[],
): ProviderPlan | ProviderAddOnPlan | null {
  if (!isValidAddOnSelection(plan, addOns)) return null
  if (addOns.length === 0) return config.plans[plan][interval]
  if (addOns.length !== 1) return null
  return config.addOns[addOns[0]!]?.[plan]?.[interval] ?? null
}

export function configuredProviderPlanBindings(config: IyzicoSubscriptionProviderConfig): {
  plan: SelfServePlan
  billingInterval: BillingInterval
  addOns: RestaurantAddOn[]
  referenceCode: string
  amountMinor: number
}[] {
  const base = SELF_SERVE_PLANS.flatMap((plan) => BILLING_INTERVALS.map((interval) => ({
    plan, billingInterval: interval, addOns: [] as RestaurantAddOn[], ...config.plans[plan][interval],
  })))
  const combined = RESTAURANT_ADD_ONS.flatMap((addOn) => {
    const group = config.addOns[addOn]
    return group ? SELF_SERVE_PLANS.flatMap((plan) => {
      const intervals = group[plan]
      return intervals ? BILLING_INTERVALS.map((interval) => ({
        plan, billingInterval: interval, addOns: [addOn], ...intervals[interval],
      })) : []
    }) : []
  })
  return [...base, ...combined]
}

/** Six immutable provider variants: Starter/Plus/Pro × monthly/annual. */
export function readIyzicoSubscriptionProviderConfig(
  env: BillingEnv = process.env,
): IyzicoSubscriptionProviderConfig {
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
  const addOns = Object.fromEntries(RESTAURANT_ADD_ONS.map((addOn) => [
    addOn, optionalAddOnPlanGroup(env, vatRate, addOn),
  ])) as IyzicoSubscriptionProviderConfig['addOns']

  const references = SELF_SERVE_PLANS.flatMap((plan) => (
    BILLING_INTERVALS.map((interval) => plans[plan][interval].referenceCode)
  )).concat(RESTAURANT_ADD_ONS.flatMap((addOn) => {
    const group = addOns[addOn]
    return group ? SELF_SERVE_PLANS.flatMap((plan) => {
      const intervals = group[plan]
      return intervals ? BILLING_INTERVALS.map((interval) => intervals[interval].referenceCode) : []
    }) : []
  }))
  if (new Set(references).size !== references.length) {
    throw new Error('IYZICO_BILLING_*_PLAN_REF values must be unique')
  }
  return {
    apiKey: requiredEnv(env, 'IYZICO_BILLING_API_KEY'),
    secretKey: requiredEnv(env, 'IYZICO_BILLING_SECRET_KEY'),
    baseUrl,
    vatRate,
    plans,
    addOns,
  }
}

/** Sales admission is intentionally separate from provider credentials.
 * Turning checkout sales off must not disable callback recovery, renewal,
 * cancellation or reconciliation work for subscriptions already sold. */
export function assertIyzicoSubscriptionSalesEnabled(env: BillingEnv = process.env): void {
  const enabled = env.SAAS_BILLING_SALES_ENABLED ?? env.SAAS_BILLING_ENABLED
  if (enabled?.trim() !== 'true') {
    throw new Error('SAAS_BILLING_SALES_ENABLED must be true to start subscription checkout')
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
