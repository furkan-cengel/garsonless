import type {
  PlatformTenantOperationsPort,
  PlatformTenantServiceControl,
  PlatformTenantServiceStatusChange,
} from '@garsonless/application/platform-admin-tenant-operations'
import { isTenantServiceStatus } from '@garsonless/domain/platform-admin'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type RpcName =
  | 'read_platform_admin_tenant_service_control'
  | 'set_platform_admin_tenant_service_status'
type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformTenantOperationsRpc = (
  name: RpcName,
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid object')
  return value as Record<string, unknown>
}

function parseControl(value: unknown): PlatformTenantServiceControl | null {
  if (value === null) return null
  const row = record(value)
  if (
    typeof row.restaurantId !== 'string' || !UUID.test(row.restaurantId)
    || !isTenantServiceStatus(row.status)
    || !Number.isSafeInteger(row.version) || (row.version as number) < 0
    || (row.updatedAt !== null && (
      typeof row.updatedAt !== 'string' || Number.isNaN(Date.parse(row.updatedAt))
    ))
  ) throw new Error('invalid control')
  return {
    restaurantId: row.restaurantId,
    status: row.status,
    version: row.version as number,
    updatedAt: row.updatedAt as string | null,
  }
}

function parseChange(value: unknown): PlatformTenantServiceStatusChange {
  const row = record(value)
  const control = parseControl(row)
  if (
    !control
    || !isTenantServiceStatus(row.previousStatus)
    || typeof row.changed !== 'boolean'
    || typeof row.requestId !== 'string' || !UUID.test(row.requestId)
  ) throw new Error('invalid status change')
  return {
    ...control,
    previousStatus: row.previousStatus,
    changed: row.changed,
    requestId: row.requestId,
  }
}

function serviceRpc(): PlatformTenantOperationsRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformTenantOperationsRpc
}

export function createPlatformAdminTenantOperationsPort(
  rpc: PlatformTenantOperationsRpc = serviceRpc(),
): PlatformTenantOperationsPort {
  return {
    async readServiceControl(restaurantId) {
      try {
        const { data, error } = await rpc('read_platform_admin_tenant_service_control', {
          p_restaurant_id: restaurantId,
        })
        if (error) return err('platform_tenant_service_control_query_failed')
        return ok(parseControl(data))
      } catch {
        return err('platform_tenant_service_control_query_failed')
      }
    },
    async setServiceStatus(input) {
      try {
        const { data, error } = await rpc('set_platform_admin_tenant_service_status', {
          p_restaurant_id: input.restaurantId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
          p_status: input.status,
          p_reason: input.reason,
          p_request_id: input.requestId,
        })
        if (error) return err('platform_tenant_service_control_mutation_failed')
        return ok(parseChange(data))
      } catch {
        return err('platform_tenant_service_control_mutation_failed')
      }
    },
  }
}

/** Service-only guard used by every new-order ingress. */
export async function readTenantOrderIngressStatus(
  restaurantId: string,
  rpc: PlatformTenantOperationsRpc = serviceRpc(),
): Promise<'active' | 'suspended' | 'manual_hold' | 'unavailable'> {
  try {
    const { data, error } = await rpc('read_platform_admin_tenant_service_control', {
      p_restaurant_id: restaurantId,
    })
    if (error) return 'unavailable'
    const control = parseControl(data)
    return control?.status ?? 'unavailable'
  } catch {
    return 'unavailable'
  }
}
