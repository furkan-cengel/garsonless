import type {
  PlatformTenantPlanChange,
  PlatformTenantPlanManagementPort,
} from '@garsonless/application/platform-admin-tenant-plans'
import {
  RESTAURANT_PLANS,
  type RestaurantPlan,
} from '@garsonless/domain/entitlements'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformTenantPlanRpc = (
  name: 'request_platform_admin_tenant_plan_transition',
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isPlan(value: unknown): value is RestaurantPlan {
  return RESTAURANT_PLANS.includes(value as RestaurantPlan)
}

function parseChange(value: unknown): PlatformTenantPlanChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object')
  const row = value as Record<string, unknown>
  if (
    typeof row.restaurantId !== 'string' || !UUID.test(row.restaurantId)
    || !isPlan(row.previousPlan)
    || !isPlan(row.requestedPlan)
    || !isPlan(row.plan)
    || typeof row.changed !== 'boolean'
    || typeof row.scheduled !== 'boolean'
    || !Number.isSafeInteger(row.openSessionCount) || (row.openSessionCount as number) < 0
    || typeof row.duplicate !== 'boolean'
    || typeof row.requestId !== 'string' || !UUID.test(row.requestId)
  ) throw new Error('invalid tenant plan change')
  return {
    restaurantId: row.restaurantId,
    previousPlan: row.previousPlan,
    requestedPlan: row.requestedPlan,
    plan: row.plan,
    changed: row.changed,
    scheduled: row.scheduled,
    openSessionCount: row.openSessionCount as number,
    duplicate: row.duplicate,
    requestId: row.requestId,
  }
}

function serviceRpc(): PlatformTenantPlanRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformTenantPlanRpc
}

export function createPlatformAdminTenantPlanManagementPort(
  rpc: PlatformTenantPlanRpc = serviceRpc(),
): PlatformTenantPlanManagementPort {
  return {
    async setPlan(input) {
      try {
        const { data, error } = await rpc('request_platform_admin_tenant_plan_transition', {
          p_restaurant_id: input.restaurantId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
          p_plan: input.plan,
          p_reason: input.reason,
          p_request_id: input.requestId,
        })
        if (error) {
          return error.message.includes('platform_tenant_plan_billing_managed')
            ? err('platform_tenant_plan_billing_managed')
            : err('platform_tenant_plan_mutation_failed')
        }
        return ok(parseChange(data))
      } catch {
        return err('platform_tenant_plan_mutation_failed')
      }
    },
  }
}
