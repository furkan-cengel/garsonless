import type {
  BillableFeature,
  EffectiveFeatureEntitlement,
  FeatureOverrideSnapshot,
  RestaurantAddOn,
} from '@garsonless/domain/entitlements'
import {
  BILLABLE_FEATURES,
  getEffectiveFeatureEntitlement,
  RESTAURANT_ADD_ONS,
} from '@garsonless/domain/entitlements'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type FeatureEntitlementRpc = (
  name: 'read_restaurant_entitlement_context' | 'read_restaurant_entitlement_contexts',
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseOverride(value: unknown): FeatureOverrideSnapshot | null {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid feature override')
  const row = value as Record<string, unknown>
  if (
    !BILLABLE_FEATURES.includes(row.feature as BillableFeature)
    || (row.decision !== 'allow' && row.decision !== 'deny')
    || typeof row.expiresAt !== 'string'
    || Number.isNaN(Date.parse(row.expiresAt))
  ) throw new Error('invalid feature override')
  return {
    feature: row.feature as BillableFeature,
    decision: row.decision,
    expiresAt: row.expiresAt,
  }
}

function parseContext(value: unknown): {
  accessAllowed: boolean
  override: FeatureOverrideSnapshot | null
  activeAddOns: RestaurantAddOn[]
  addOnEntitlementsVersion: 0 | 1
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid entitlement context')
  const row = value as Record<string, unknown>
  if (typeof row.accessAllowed !== 'boolean') throw new Error('invalid entitlement context')
  const candidateAddOns = row.activeAddOns ?? []
  if (!Array.isArray(candidateAddOns)
    || candidateAddOns.some((item) => !RESTAURANT_ADD_ONS.includes(item as RestaurantAddOn))) {
    throw new Error('invalid entitlement context')
  }
  return {
    accessAllowed: row.accessAllowed,
    override: parseOverride(row.override),
    activeAddOns: candidateAddOns as RestaurantAddOn[],
    addOnEntitlementsVersion: row.addOnEntitlementsVersion === 1 ? 1 : 0,
  }
}

function serviceRpc(): FeatureEntitlementRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as FeatureEntitlementRpc
}

export async function resolveRestaurantFeatureEntitlement(
  input: { restaurantId: string; plan: unknown; feature: BillableFeature; now?: Date },
  rpc: FeatureEntitlementRpc = serviceRpc(),
): Promise<Result<EffectiveFeatureEntitlement, 'feature_entitlement_resolution_failed'>> {
  if (!UUID.test(input.restaurantId) || !BILLABLE_FEATURES.includes(input.feature)) {
    return err('feature_entitlement_resolution_failed')
  }
  try {
    const { data, error } = await rpc('read_restaurant_entitlement_context', {
      p_restaurant_id: input.restaurantId,
      p_feature: input.feature,
    })
    if (error) return err('feature_entitlement_resolution_failed')
    return ok(evaluateContext(input.plan, input.feature, data, input.now))
  } catch {
    return err('feature_entitlement_resolution_failed')
  }
}

/** Shared by the single and batched resolvers so both apply identical rules. */
function evaluateContext(
  plan: unknown,
  feature: BillableFeature,
  value: unknown,
  now?: Date,
): EffectiveFeatureEntitlement {
  const context = parseContext(value)
  // Add-on access fails closed when the database projection is stale or
  // absent. A plan name must never stand in for a paid add-on entitlement.
  const activeAddOns = context.addOnEntitlementsVersion === 1
    ? context.activeAddOns
    : []
  const entitlement = getEffectiveFeatureEntitlement(plan, feature, context.override, now, activeAddOns)
  return context.accessAllowed ? entitlement : {
    ...entitlement,
    allowed: false,
    source: 'plan',
    override: null,
  }
}

/**
 * Resolves several features for one restaurant in a single round trip. Falls
 * back to one call per feature if the batched RPC is unavailable (for example
 * before its migration reaches an environment). Every feature fails closed.
 */
export async function canRestaurantUseFeatures<const F extends BillableFeature>(
  input: { restaurantId: string; plan: unknown; features: readonly F[]; now?: Date },
  rpc: FeatureEntitlementRpc = serviceRpc(),
): Promise<Record<F, boolean>> {
  const features = [...new Set(input.features)]
  const denied = Object.fromEntries(features.map((feature) => [feature, false])) as Record<F, boolean>
  if (!UUID.test(input.restaurantId) || features.some((feature) => !BILLABLE_FEATURES.includes(feature))) return denied
  if (features.length === 0) return denied

  let contexts: Record<string, unknown> | null = null
  try {
    const { data, error } = await rpc('read_restaurant_entitlement_contexts', {
      p_restaurant_id: input.restaurantId,
      p_features: features,
    })
    if (!error && data && typeof data === 'object' && !Array.isArray(data)) contexts = data as Record<string, unknown>
  } catch {
    contexts = null
  }

  if (!contexts) {
    const results = await Promise.all(features.map((feature) =>
      canRestaurantUseFeature({ restaurantId: input.restaurantId, plan: input.plan, feature, ...(input.now ? { now: input.now } : {}) }, rpc)))
    return Object.fromEntries(features.map((feature, index) => [feature, results[index] === true])) as Record<F, boolean>
  }

  return Object.fromEntries(features.map((feature) => {
    try {
      return [feature, evaluateContext(input.plan, feature, contexts[feature], input.now).allowed]
    } catch {
      return [feature, false]
    }
  })) as Record<F, boolean>
}

/** Convenience gate for server adapters. Infrastructure or malformed data deny access. */
export async function canRestaurantUseFeature(
  input: { restaurantId: string; plan: unknown; feature: BillableFeature; now?: Date },
  rpc?: FeatureEntitlementRpc,
): Promise<boolean> {
  const result = await resolveRestaurantFeatureEntitlement(input, rpc)
  return result.ok && result.value.allowed
}

/** Server-only convenience for public routes. The plan is intentionally read
 * with the service client so it never has to be exposed through the anonymous
 * restaurant projection. */
export async function canPublicRestaurantUseFeature(input: {
  restaurantId: string
  feature: BillableFeature
  now?: Date
}): Promise<boolean> {
  if (!UUID.test(input.restaurantId) || !BILLABLE_FEATURES.includes(input.feature)) return false
  const { data, error } = await createServiceClient()
    .from('restaurants')
    .select('plan')
    .eq('id', input.restaurantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return false
  return canRestaurantUseFeature({ ...input, plan: data.plan })
}
