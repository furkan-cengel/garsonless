/**
 * The canonical SaaS catalogue. UI badges may consume it, but this module is
 * browser-safe and deliberately has no database or payment-provider knowledge.
 * Server command adapters use the same vocabulary to enforce paid features.
 */
export const RESTAURANT_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const
export type RestaurantPlan = (typeof RESTAURANT_PLANS)[number]

/** `business` was marketing copy; persisted tenants use `enterprise`. */
export function normalizeRestaurantPlan(value: unknown): RestaurantPlan {
  if (value === 'business') return 'enterprise'
  return RESTAURANT_PLANS.includes(value as RestaurantPlan) ? value as RestaurantPlan : 'free'
}

export const BILLABLE_FEATURES = [
  'qr_menu',
  'orders',
  'table_management',
  'analytics_basic',
  'theme_editor',
  'browser_notifications',
  'kitchen_display',
  'loyalty',
  'analytics_advanced',
  'theme_advanced_sections',
  'multi_location',
  'api_access',
  'webhooks',
  'sso',
  'white_label',
] as const
export type BillableFeature = (typeof BILLABLE_FEATURES)[number]

/**
 * Features whose runtime gates already resolve tenant-specific exceptions.
 * Keep the admin surface closed to this list so an operator can never create
 * an override which the product would silently ignore.
 */
export const RUNTIME_OVERRIDEABLE_FEATURES = [
  'browser_notifications',
  'kitchen_display',
  'loyalty',
  'analytics_advanced',
  'theme_advanced_sections',
] as const satisfies readonly BillableFeature[]
export type RuntimeOverrideableFeature = (typeof RUNTIME_OVERRIDEABLE_FEATURES)[number]

export type PlanLimits = {
  tables: number | null
  locations: number | null
  teamMembers: number | null
}

export type PlanDefinition = {
  label: string
  features: readonly BillableFeature[]
  limits: PlanLimits
}

export const PLAN_DEFINITIONS: Record<RestaurantPlan, PlanDefinition> = {
  free: {
    label: 'Ücretsiz',
    features: ['qr_menu', 'orders', 'table_management', 'analytics_basic'],
    limits: { tables: 3, locations: 1, teamMembers: 1 },
  },
  starter: {
    label: 'Starter',
    features: ['qr_menu', 'orders', 'table_management', 'analytics_basic', 'theme_editor', 'browser_notifications'],
    limits: { tables: 10, locations: 1, teamMembers: 3 },
  },
  pro: {
    label: 'Pro',
    features: [
      'qr_menu', 'orders', 'table_management', 'analytics_basic', 'theme_editor', 'browser_notifications',
      'kitchen_display', 'loyalty', 'analytics_advanced', 'theme_advanced_sections', 'multi_location',
    ],
    limits: { tables: 50, locations: 3, teamMembers: 10 },
  },
  enterprise: {
    label: 'Enterprise',
    features: [...BILLABLE_FEATURES],
    limits: { tables: null, locations: null, teamMembers: null },
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

/**
 * A short-lived, audited exception to the canonical plan catalogue. Persistence
 * and actor authorization live on the server; this snapshot stays browser-safe
 * so every adapter resolves the same semantics.
 */
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
  const allowed = PLAN_DEFINITIONS[plan].features.includes(feature)
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

export function getPlanLimit(planInput: unknown, limit: keyof PlanLimits): number | null {
  return PLAN_DEFINITIONS[normalizeRestaurantPlan(planInput)].limits[limit]
}

/** `null` means unlimited. Counts at the limit are not allowed to create another resource. */
export function isWithinPlanLimit(planInput: unknown, limit: keyof PlanLimits, currentCount: number): boolean {
  const maximum = getPlanLimit(planInput, limit)
  return maximum === null || currentCount < maximum
}
