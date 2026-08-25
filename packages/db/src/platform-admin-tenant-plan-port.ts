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
  name: 'set_platform_admin_tenant_plan',
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
    || !isPlan(row.plan)
    || typeof row.changed !== 'boolean'
    || typeof row.duplicate !== 'boolean'
    || typeof row.requestId !== 'string' || !UUID.test(row.requestId)
  ) throw new Error('invalid tenant plan change')
  return {
    restaurantId: row.restaurantId,
    previousPlan: row.previousPlan,
    plan: row.plan,
    changed: row.changed,
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
        const { data, error } = await rpc('set_platform_admin_tenant_plan', {
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
