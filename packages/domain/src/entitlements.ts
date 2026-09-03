/**
 * Canonical SaaS catalogue. This module is browser-safe and deliberately has
 * no database or payment-provider knowledge. Product UI and server adapters
 * consume the same plans, prices and feature vocabulary.
 */
export const RESTAURANT_PLANS = ['starter', 'plus', 'pro', 'business'] as const
export type RestaurantPlan = (typeof RESTAURANT_PLANS)[number]

export const SELF_SERVE_PLANS = ['starter', 'plus', 'pro'] as const
export type SelfServePlan = (typeof SELF_SERVE_PLANS)[number]

export const BILLING_INTERVALS = ['monthly', 'annual'] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

/** Optional products are deliberately separate from plan features. Buying a
 * Pro plan alone must not silently enable a provider integration that has its
 * own commercial and operational contract. */
export const RESTAURANT_ADD_ONS = ['iyzico_online_payments', 'storefront_video_hero'] as const
export type RestaurantAddOn = (typeof RESTAURANT_ADD_ONS)[number]

export const ADD_ON_DEFINITIONS: Readonly<Record<RestaurantAddOn, {
  label: string
  description: string
  availableOn: readonly RestaurantPlan[]
  grants: readonly BillableFeature[]
}>> = {
  iyzico_online_payments: {
    label: 'İyzico Online Ödeme',
    description: 'Misafirlerin QR menüden kartla ödeme yapmasını sağlayan Pro eklentisi.',
    availableOn: ['pro', 'business'],
    grants: ['online_payments'],
  },
  storefront_video_hero: {
    label: 'Video Hero',
    description: 'Ana sayfanın üstünde poster destekli, sessiz ve döngülü hero videosu. Pro pakete dahildir; alt paketlere eklenti olarak açılır.',
    availableOn: ['starter', 'plus'],
    grants: ['theme_video_hero'],
  },
}

/** Legacy persisted values are accepted only while the catalogue migration is rolling out. */
export function normalizeRestaurantPlan(value: unknown): RestaurantPlan {
  if (value === 'free') return 'starter'
  if (value === 'enterprise') return 'business'
  return RESTAURANT_PLANS.includes(value as RestaurantPlan) ? value as RestaurantPlan : 'starter'
}

function isKnownPlanInput(value: unknown): boolean {
  return value === 'free' || value === 'enterprise' || RESTAURANT_PLANS.includes(value as RestaurantPlan)
}

export const PLAN_PRICE_CURRENCY = 'TRY' as const

export type PlanPrice = {
  /** KDV hariç liste fiyatı, TRY minor units (kuruş). */
  amountMinor: number
  currency: typeof PLAN_PRICE_CURRENCY
  vatIncluded: false
}

export const PLAN_PRICES: Readonly<Record<SelfServePlan, Readonly<Record<BillingInterval, PlanPrice>>>> = {
  starter: {
    monthly: { amountMinor: 34_900, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
    annual: { amountMinor: 335_040, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
  },
  plus: {
    monthly: { amountMinor: 69_900, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
    annual: { amountMinor: 671_040, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
  },
  pro: {
    monthly: { amountMinor: 119_900, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
    annual: { amountMinor: 1_151_040, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
  },
}

/** İyzico Online Ödeme is sold only as a Pro add-on. It follows the same
 * annual catalogue policy as self-serve plans: twelve monthly payments minus
 * twenty percent. Values are KDV-exclusive and are never provider-derived. */
export const ADD_ON_PRICES: Readonly<Record<RestaurantAddOn, Readonly<Record<BillingInterval, PlanPrice>>>> = {
  iyzico_online_payments: {
    monthly: { amountMinor: 30_000, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
    annual: { amountMinor: 288_000, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
  },
  storefront_video_hero: {
    monthly: { amountMinor: 3_900, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
    annual: { amountMinor: 37_440, currency: PLAN_PRICE_CURRENCY, vatIncluded: false },
  },
}

export function getPlanPrice(plan: SelfServePlan, interval: BillingInterval): PlanPrice {
  return PLAN_PRICES[plan][interval]
}

export function getAddOnPrice(addOn: RestaurantAddOn, interval: BillingInterval): PlanPrice {
  return ADD_ON_PRICES[addOn][interval]
}

export function isAddOnAvailableOnPlan(
  addOn: RestaurantAddOn,
  plan: RestaurantPlan,
): boolean {
  return ADD_ON_DEFINITIONS[addOn].availableOn.includes(plan)
}

/** Canonical commercial compatibility boundary shared by checkout, plan
 * changes, provider configuration and presentation. Unknown, duplicate or
 * plan-incompatible add-ons fail closed. */
export function isValidAddOnSelection(
  plan: RestaurantPlan,
  addOns: readonly unknown[],
): addOns is readonly RestaurantAddOn[] {
  return new Set(addOns).size === addOns.length
    && addOns.every((addOn) => RESTAURANT_ADD_ONS.includes(addOn as RestaurantAddOn)
      && isAddOnAvailableOnPlan(addOn as RestaurantAddOn, plan))
}

export function subscriptionNetAmountMinor(
  plan: SelfServePlan,
  interval: BillingInterval,
  addOns: readonly RestaurantAddOn[] = [],
): number {
  if (!isValidAddOnSelection(plan, addOns)) {
    throw new Error('Add-on selection is not available on the selected plan')
  }
  return getPlanPrice(plan, interval).amountMinor
    + addOns.reduce((total, addOn) => total + getAddOnPrice(addOn, interval).amountMinor, 0)
}

export function calculatePlanCharge(price: PlanPrice, vatRate: number): {
  netAmountMinor: number
  vatAmountMinor: number
  totalAmountMinor: number
} {
  if (!Number.isInteger(vatRate) || vatRate < 0 || vatRate > 100) {
    throw new Error('VAT rate must be an integer between 0 and 100')
  }
  const vatAmountMinor = Math.round(price.amountMinor * vatRate / 100)
  return {
    netAmountMinor: price.amountMinor,
    vatAmountMinor,
    totalAmountMinor: price.amountMinor + vatAmountMinor,
  }
}

export const BILLABLE_FEATURES = [
  'qr_menu',
  'rich_product_content',
  'theme_editor',
  'qr_studio',
  'table_management',
  'staff_orders',
  'settlement',
  'analytics_basic',
  'team_management',
  'guest_ordering',
  'service_requests',
  'kitchen_display',
  'online_payments',
  'split_payments',
  'customer_accounts',
  'crm',
  'loyalty',
  'campaigns',
  'analytics_advanced',
  'browser_notifications',
  'theme_advanced_sections',
  'theme_video_hero',
  'multi_location',
] as const
export type BillableFeature = (typeof BILLABLE_FEATURES)[number]

/** Features whose admin override workflow is already audited end-to-end. */
export const RUNTIME_OVERRIDEABLE_FEATURES = [
  'browser_notifications',
  'kitchen_display',
  'loyalty',
  'analytics_advanced',
  'theme_advanced_sections',
] as const satisfies readonly BillableFeature[]
export type RuntimeOverrideableFeature = (typeof RUNTIME_OVERRIDEABLE_FEATURES)[number]

export type PlanDefinition = {
  label: string
  description: string
  features: readonly BillableFeature[]
}

const STARTER_FEATURES = [
  'qr_menu',
  'rich_product_content',
  'theme_editor',
  'qr_studio',
] as const satisfies readonly BillableFeature[]

const PLUS_FEATURES = [
  ...STARTER_FEATURES,
  'table_management',
  'staff_orders',
  'settlement',
  'analytics_basic',
  'team_management',
] as const satisfies readonly BillableFeature[]

const PRO_FEATURES = [
  ...PLUS_FEATURES,
  'guest_ordering',
  'service_requests',
  'kitchen_display',
  'split_payments',
  'customer_accounts',
  'crm',
  'loyalty',
  'campaigns',
  'analytics_advanced',
  'browser_notifications',
  'theme_advanced_sections',
  'theme_video_hero',
] as const satisfies readonly BillableFeature[]

export const PLAN_DEFINITIONS: Readonly<Record<RestaurantPlan, PlanDefinition>> = {
  starter: {
    label: 'Starter',
    description: 'Dijital menüsünü profesyonelce yayınlamak isteyen işletmeler için.',
    features: STARTER_FEATURES,
  },
  plus: {
    label: 'Plus',
    description: 'Masa, adisyon ve personel siparişlerini tek ekrandan yönetin.',
    features: PLUS_FEATURES,
  },
  pro: {
    label: 'Pro',
    description: 'Müşteri siparişinden sadakate tüm restoran operasyonu.',
    features: PRO_FEATURES,
  },
  business: {
    label: 'Business',
    description: 'Birden fazla şube ve ortak ekip erişimi için satış destekli paket.',
    features: [...PRO_FEATURES, 'multi_location'],
  },
}

export type FeatureEntitlement = {
  feature: BillableFeature
  plan: RestaurantPlan
  allowed: boolean
  /** The lowest catalogued plan which includes the feature, if any. */
  requiredPlan: RestaurantPlan | null
}

export const FEATURE_OVERRIDE_DECISIONS = ['allow', 'deny'] as const
export type FeatureOverrideDecision = (typeof FEATURE_OVERRIDE_DECISIONS)[number]

export type FeatureOverrideSnapshot = {
  feature: BillableFeature
  decision: FeatureOverrideDecision
  expiresAt: string
}

export type EffectiveFeatureEntitlement = FeatureEntitlement & {
  source: 'plan' | 'override'
  override: FeatureOverrideSnapshot | null
}

function addOnGrantsFeature(
  plan: RestaurantPlan,
  feature: BillableFeature,
  activeAddOns: readonly RestaurantAddOn[],
): boolean {
  return activeAddOns.some((addOn) => {
    const definition = ADD_ON_DEFINITIONS[addOn]
    return definition.availableOn.includes(plan) && definition.grants.includes(feature)
  })
}

export function getFeatureEntitlement(
  planInput: unknown,
  feature: BillableFeature,
  activeAddOns: readonly RestaurantAddOn[] = [],
): FeatureEntitlement {
  const plan = normalizeRestaurantPlan(planInput)
  const known = isKnownPlanInput(planInput)
  const allowed = known && (
    PLAN_DEFINITIONS[plan].features.includes(feature)
    || addOnGrantsFeature(plan, feature, activeAddOns)
  )
  const requiredPlan = RESTAURANT_PLANS.find((candidate) => (
    PLAN_DEFINITIONS[candidate].features.includes(feature)
    || RESTAURANT_ADD_ONS.some((addOn) => (
      ADD_ON_DEFINITIONS[addOn].availableOn.includes(candidate)
      && ADD_ON_DEFINITIONS[addOn].grants.includes(feature)
    ))
  )) ?? null
  return { feature, plan, allowed, requiredPlan }
}

export function canUseFeature(
  planInput: unknown,
  feature: BillableFeature,
  activeAddOns: readonly RestaurantAddOn[] = [],
): boolean {
  return getFeatureEntitlement(planInput, feature, activeAddOns).allowed
}

export function getEffectiveFeatureEntitlement(
  planInput: unknown,
  feature: BillableFeature,
  override: FeatureOverrideSnapshot | null | undefined,
  now: Date = new Date(),
  activeAddOns: readonly RestaurantAddOn[] = [],
): EffectiveFeatureEntitlement {
  const planEntitlement = getFeatureEntitlement(planInput, feature, activeAddOns)
  const expiresAt = override ? Date.parse(override.expiresAt) : Number.NaN
  const isActiveOverride = Boolean(
    override
    && override.feature === feature
    && FEATURE_OVERRIDE_DECISIONS.includes(override.decision)
    && Number.isFinite(expiresAt)
    && expiresAt > now.getTime(),
  )

  if (!override || !isActiveOverride) {
    return { ...planEntitlement, source: 'plan', override: null }
  }

  return {
    ...planEntitlement,
    allowed: override.decision === 'allow',
    source: 'override',
    override,
  }
}

export function canUseEffectiveFeature(
  planInput: unknown,
  feature: BillableFeature,
  override: FeatureOverrideSnapshot | null | undefined,
  now?: Date,
  activeAddOns: readonly RestaurantAddOn[] = [],
): boolean {
  return getEffectiveFeatureEntitlement(planInput, feature, override, now, activeAddOns).allowed
}
