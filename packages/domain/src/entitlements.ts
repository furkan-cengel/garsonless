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
  /** KDV dahil, TRY minor units (kuruş). */
  amountMinor: number
  currency: typeof PLAN_PRICE_CURRENCY
  vatIncluded: true
}

export const PLAN_PRICES: Readonly<Record<SelfServePlan, Readonly<Record<BillingInterval, PlanPrice>>>> = {
  starter: {
    monthly: { amountMinor: 34_900, currency: PLAN_PRICE_CURRENCY, vatIncluded: true },
    annual: { amountMinor: 335_040, currency: PLAN_PRICE_CURRENCY, vatIncluded: true },
  },
  plus: {
    monthly: { amountMinor: 69_900, currency: PLAN_PRICE_CURRENCY, vatIncluded: true },
    annual: { amountMinor: 671_040, currency: PLAN_PRICE_CURRENCY, vatIncluded: true },
  },
  pro: {
    monthly: { amountMinor: 119_900, currency: PLAN_PRICE_CURRENCY, vatIncluded: true },
    annual: { amountMinor: 1_151_040, currency: PLAN_PRICE_CURRENCY, vatIncluded: true },
  },
}

export function getPlanPrice(plan: SelfServePlan, interval: BillingInterval): PlanPrice {
  return PLAN_PRICES[plan][interval]
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
] as const satisfies readonly BillableFeature[]

const PLUS_FEATURES = [
  ...STARTER_FEATURES,
  'qr_studio',
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
  'online_payments',
  'split_payments',
  'customer_accounts',
  'crm',
  'loyalty',
  'campaigns',
  'analytics_advanced',
  'browser_notifications',
  'theme_advanced_sections',
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

export function getFeatureEntitlement(planInput: unknown, feature: BillableFeature): FeatureEntitlement {
  const plan = normalizeRestaurantPlan(planInput)
  const known = isKnownPlanInput(planInput)
  const allowed = known && PLAN_DEFINITIONS[plan].features.includes(feature)
  const requiredPlan = RESTAURANT_PLANS.find((candidate) => PLAN_DEFINITIONS[candidate].features.includes(feature)) ?? null
  return { feature, plan, allowed, requiredPlan }
}

export function canUseFeature(planInput: unknown, feature: BillableFeature): boolean {
  return getFeatureEntitlement(planInput, feature).allowed
}

export function getEffectiveFeatureEntitlement(
  planInput: unknown,
  feature: BillableFeature,
  override: FeatureOverrideSnapshot | null | undefined,
  now: Date = new Date(),
): EffectiveFeatureEntitlement {
  const planEntitlement = getFeatureEntitlement(planInput, feature)
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
): boolean {
  return getEffectiveFeatureEntitlement(planInput, feature, override, now).allowed
}
