import {
  RESTAURANT_PLANS,
  type RestaurantPlan,
} from '@garsonless/domain/entitlements'
import {
  platformAdminCan,
  type PlatformAdminActorContext,
} from '@garsonless/domain/platform-admin'
import { err, type Result } from '@garsonless/domain/result'

export type PlatformTenantPlanChange = {
  restaurantId: string
  previousPlan: RestaurantPlan
  plan: RestaurantPlan
  changed: boolean
  duplicate: boolean
  requestId: string
}

export interface PlatformTenantPlanManagementPort {
  setPlan(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
    plan: RestaurantPlan
    reason: string
    requestId: string
  }): Promise<Result<PlatformTenantPlanChange>>
}

export type PlatformTenantPlanError =
  | 'Not authorized'
  | 'Invalid tenant id'
  | 'Invalid plan'
  | 'Invalid operation reason'
  | 'Invalid request id'
  | 'Tenant plan is managed by an active billing subscription'
  | 'Tenant plan could not be changed'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function setPlatformTenantPlan(
  actor: PlatformAdminActorContext,
  input: {
    restaurantId: string
    plan: RestaurantPlan
    reason: string
    requestId: string
  },
  port: PlatformTenantPlanManagementPort,
): Promise<Result<PlatformTenantPlanChange, PlatformTenantPlanError>> {
  // ADR-0004: catalog/plan management is superadmin-only. Finance can manage
  // invoices and dunning, but cannot grant paid capabilities.
  if (!platformAdminCan(actor, 'catalog.manage')) return err('Not authorized')
  if (!UUID.test(input.restaurantId)) return err('Invalid tenant id')
  if (!RESTAURANT_PLANS.includes(input.plan)) return err('Invalid plan')
  if (!UUID.test(input.requestId)) return err('Invalid request id')
  const reason = input.reason.trim()
  if (reason.length < 10 || reason.length > 1000) return err('Invalid operation reason')

  const result = await port.setPlan({
    restaurantId: input.restaurantId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    plan: input.plan,
    reason,
    requestId: input.requestId,
  })
  if (result.ok) return result
  return result.error === 'platform_tenant_plan_billing_managed'
    ? err('Tenant plan is managed by an active billing subscription')
    : err('Tenant plan could not be changed')
}
