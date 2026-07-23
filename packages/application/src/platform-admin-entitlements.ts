import {
  FEATURE_OVERRIDE_DECISIONS,
  RUNTIME_OVERRIDEABLE_FEATURES,
  type BillableFeature,
  type FeatureOverrideDecision,
} from '@garsonless/domain/entitlements'
import {
  platformAdminCan,
  type PlatformAdminActorContext,
} from '@garsonless/domain/platform-admin'
import { err, type Result } from '@garsonless/domain/result'

export const PLATFORM_ENTITLEMENT_OVERRIDE_ACTIONS = ['set', 'revoke'] as const
export type PlatformEntitlementOverrideAction = typeof PLATFORM_ENTITLEMENT_OVERRIDE_ACTIONS[number]

export type PlatformTenantFeatureOverride = {
  restaurantId: string
  feature: BillableFeature
  decision: FeatureOverrideDecision
  expiresAt: string
  reason: string
  updatedAt: string
  updatedBy: string
}

export type PlatformEntitlementOverrideMutationResult = {
  restaurantId: string
  feature: BillableFeature
  action: PlatformEntitlementOverrideAction
  before: PlatformTenantFeatureOverride | null
  after: PlatformTenantFeatureOverride | null
  duplicate: boolean
  requestId: string
}

export interface PlatformTenantEntitlementReadPort {
  readOverrides(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
  }): Promise<Result<PlatformTenantFeatureOverride[]>>
}

export interface PlatformTenantEntitlementMutationPort {
  changeOverride(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
    action: PlatformEntitlementOverrideAction
    feature: BillableFeature
    decision: FeatureOverrideDecision | null
    durationDays: number | null
    reason: string
    requestId: string
  }): Promise<Result<PlatformEntitlementOverrideMutationResult>>
}

export type PlatformTenantEntitlementReadError =
  | 'Not authorized'
  | 'Invalid tenant id'
  | 'Feature overrides could not be loaded'

export type PlatformTenantEntitlementMutationError =
  | 'Not authorized'
  | 'Invalid tenant id'
  | 'Invalid feature'
  | 'Invalid override action'
  | 'Invalid override decision'
  | 'Invalid override duration'
  | 'Invalid operation reason'
  | 'Invalid request id'
  | 'Feature override could not be changed'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function readPlatformTenantFeatureOverrides(
  actor: PlatformAdminActorContext,
  restaurantId: string,
  port: PlatformTenantEntitlementReadPort,
): Promise<Result<PlatformTenantFeatureOverride[], PlatformTenantEntitlementReadError>> {
  if (!platformAdminCan(actor, 'tenants.read')) return err('Not authorized')
  if (!UUID.test(restaurantId)) return err('Invalid tenant id')
  const result = await port.readOverrides({
    restaurantId,
    actorUserId: actor.userId,
    actorRole: actor.role,
  })
  return result.ok ? result : err('Feature overrides could not be loaded')
}

export async function changePlatformTenantFeatureOverride(
  actor: PlatformAdminActorContext,
  input: {
    restaurantId: string
    action: PlatformEntitlementOverrideAction
    feature: BillableFeature
    decision?: FeatureOverrideDecision | null
    durationDays?: number | null
    reason: string
    requestId: string
  },
  port: PlatformTenantEntitlementMutationPort,
): Promise<Result<PlatformEntitlementOverrideMutationResult, PlatformTenantEntitlementMutationError>> {
  if (!platformAdminCan(actor, 'entitlements.override')) return err('Not authorized')
  if (!UUID.test(input.restaurantId)) return err('Invalid tenant id')
  if (!RUNTIME_OVERRIDEABLE_FEATURES.includes(input.feature as typeof RUNTIME_OVERRIDEABLE_FEATURES[number])) {
    return err('Invalid feature')
  }
  if (!PLATFORM_ENTITLEMENT_OVERRIDE_ACTIONS.includes(input.action)) return err('Invalid override action')
  if (!UUID.test(input.requestId)) return err('Invalid request id')

  const reason = input.reason.trim()
  if (reason.length < 10 || reason.length > 1000) return err('Invalid operation reason')

  const decision = input.action === 'set' ? input.decision ?? null : null
  const durationDays = input.action === 'set' ? input.durationDays ?? null : null
  if (input.action === 'set' && !FEATURE_OVERRIDE_DECISIONS.includes(decision as FeatureOverrideDecision)) {
    return err('Invalid override decision')
  }
  if (input.action === 'set' && (!Number.isInteger(durationDays) || durationDays === null || durationDays < 1 || durationDays > 30)) {
    return err('Invalid override duration')
  }

  const result = await port.changeOverride({
    restaurantId: input.restaurantId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: input.action,
    feature: input.feature,
    decision,
    durationDays,
    reason,
    requestId: input.requestId,
  })
  return result.ok ? result : err('Feature override could not be changed')
}
