import type {
  PlatformEntitlementOverrideMutationResult,
  PlatformTenantEntitlementMutationPort,
  PlatformTenantEntitlementReadPort,
  PlatformTenantFeatureOverride,
} from '@garsonless/application/platform-admin-entitlements'
import {
  FEATURE_OVERRIDE_DECISIONS,
  RUNTIME_OVERRIDEABLE_FEATURES,
  type BillableFeature,
  type FeatureOverrideDecision,
} from '@garsonless/domain/entitlements'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformEntitlementRpc = (
  name: 'read_platform_admin_tenant_feature_overrides' | 'change_platform_admin_tenant_feature_override',
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object')
  return value as Record<string, unknown>
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('invalid timestamp')
  return value
}

function parseFeature(value: unknown): BillableFeature {
  if (!RUNTIME_OVERRIDEABLE_FEATURES.includes(value as typeof RUNTIME_OVERRIDEABLE_FEATURES[number])) {
    throw new Error('invalid feature')
  }
  return value as BillableFeature
}

function parseDecision(value: unknown): FeatureOverrideDecision {
  if (!FEATURE_OVERRIDE_DECISIONS.includes(value as FeatureOverrideDecision)) throw new Error('invalid decision')
  return value as FeatureOverrideDecision
}

function parseOverride(value: unknown): PlatformTenantFeatureOverride {
  const row = record(value)
  if (
    typeof row.restaurantId !== 'string' || !UUID.test(row.restaurantId)
    || typeof row.reason !== 'string' || row.reason.length < 10
    || typeof row.updatedBy !== 'string' || !UUID.test(row.updatedBy)
  ) throw new Error('invalid override')
  return {
    restaurantId: row.restaurantId,
    feature: parseFeature(row.feature),
    decision: parseDecision(row.decision),
    expiresAt: timestamp(row.expiresAt),
    reason: row.reason,
    updatedAt: timestamp(row.updatedAt),
    updatedBy: row.updatedBy,
  }
}

function nullableOverride(value: unknown): PlatformTenantFeatureOverride | null {
  return value === null ? null : parseOverride(value)
}

function parseMutation(value: unknown): PlatformEntitlementOverrideMutationResult {
  const row = record(value)
  if (
    typeof row.restaurantId !== 'string' || !UUID.test(row.restaurantId)
    || (row.action !== 'set' && row.action !== 'revoke')
    || typeof row.duplicate !== 'boolean'
    || typeof row.requestId !== 'string' || !UUID.test(row.requestId)
  ) throw new Error('invalid mutation')
  return {
    restaurantId: row.restaurantId,
    feature: parseFeature(row.feature),
    action: row.action,
    before: nullableOverride(row.before),
    after: nullableOverride(row.after),
    duplicate: row.duplicate,
    requestId: row.requestId,
  }
}

function serviceRpc(): PlatformEntitlementRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformEntitlementRpc
}

export function createPlatformAdminEntitlementPort(
  rpc: PlatformEntitlementRpc = serviceRpc(),
): PlatformTenantEntitlementReadPort & PlatformTenantEntitlementMutationPort {
  return {
    async readOverrides(input) {
      try {
        const { data, error } = await rpc('read_platform_admin_tenant_feature_overrides', {
          p_restaurant_id: input.restaurantId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
        })
        if (error || !Array.isArray(data)) return err('platform_entitlement_read_failed')
        return ok(data.map(parseOverride))
      } catch {
        return err('platform_entitlement_read_failed')
      }
    },
    async changeOverride(input) {
      try {
        const { data, error } = await rpc('change_platform_admin_tenant_feature_override', {
          p_restaurant_id: input.restaurantId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
          p_action: input.action,
          p_feature: input.feature,
          p_decision: input.decision,
          p_duration_days: input.durationDays,
          p_reason: input.reason,
          p_request_id: input.requestId,
        })
        if (error) return err('platform_entitlement_mutation_failed')
        return ok(parseMutation(data))
      } catch {
        return err('platform_entitlement_mutation_failed')
      }
    },
  }
}
