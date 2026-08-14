import type {
  BillableFeature,
  EffectiveFeatureEntitlement,
  FeatureOverrideSnapshot,
} from '@garsonless/domain/entitlements'
import { BILLABLE_FEATURES, getEffectiveFeatureEntitlement } from '@garsonless/domain/entitlements'
import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type FeatureEntitlementRpc = (
  name: 'read_restaurant_entitlement_context',
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

function parseContext(value: unknown): { accessAllowed: boolean; override: FeatureOverrideSnapshot | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid entitlement context')
  const row = value as Record<string, unknown>
  if (typeof row.accessAllowed !== 'boolean') throw new Error('invalid entitlement context')
  return { accessAllowed: row.accessAllowed, override: parseOverride(row.override) }
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
    const context = parseContext(data)
    const entitlement = getEffectiveFeatureEntitlement(input.plan, input.feature, context.override, input.now)
    return ok(context.accessAllowed ? entitlement : {
      ...entitlement,
      allowed: false,
      source: 'plan',
      override: null,
    })
  } catch {
    return err('feature_entitlement_resolution_failed')
  }
}

/** Convenience gate for server adapters. Infrastructure or malformed data deny access. */
export async function canRestaurantUseFeature(
  input: { restaurantId: string; plan: unknown; feature: BillableFeature; now?: Date },
  rpc?: FeatureEntitlementRpc,
): Promise<boolean> {
  const result = await resolveRestaurantFeatureEntitlement(input, rpc)
  return result.ok && result.value.allowed
}
