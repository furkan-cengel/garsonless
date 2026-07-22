import {
  isTenantServiceStatus,
  platformAdminCan,
  type PlatformAdminActorContext,
  type TenantServiceStatus,
} from '@garsonless/domain/platform-admin'
import { err, type Result } from '@garsonless/domain/result'

export type PlatformTenantServiceControl = {
  restaurantId: string
  status: TenantServiceStatus
  version: number
  updatedAt: string | null
}

export type PlatformTenantServiceStatusChange = PlatformTenantServiceControl & {
  previousStatus: TenantServiceStatus
  changed: boolean
  requestId: string
}

export interface PlatformTenantOperationsPort {
  readServiceControl(restaurantId: string): Promise<Result<PlatformTenantServiceControl | null>>
  setServiceStatus(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
    status: TenantServiceStatus
    reason: string
    requestId: string
  }): Promise<Result<PlatformTenantServiceStatusChange>>
}

export type PlatformTenantOperationError =
  | 'Not authorized'
  | 'Invalid tenant id'
  | 'Invalid service status'
  | 'Invalid operation reason'
  | 'Invalid request id'
  | 'Tenant service status could not be loaded'
  | 'Tenant service status could not be changed'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function readPlatformTenantServiceControl(
  actor: PlatformAdminActorContext,
  restaurantId: string,
  port: PlatformTenantOperationsPort,
): Promise<Result<PlatformTenantServiceControl, PlatformTenantOperationError>> {
  if (!platformAdminCan(actor, 'tenants.read')) return err('Not authorized')
  if (!UUID.test(restaurantId)) return err('Invalid tenant id')
  const result = await port.readServiceControl(restaurantId)
  if (!result.ok) return err('Tenant service status could not be loaded')
  return result.value
    ? { ok: true, value: result.value }
    : {
        ok: true,
        value: { restaurantId, status: 'active', version: 0, updatedAt: null },
      }
}

export async function setPlatformTenantServiceStatus(
  actor: PlatformAdminActorContext,
  input: {
    restaurantId: string
    status: TenantServiceStatus
    reason: string
    requestId: string
  },
  port: PlatformTenantOperationsPort,
): Promise<Result<PlatformTenantServiceStatusChange, PlatformTenantOperationError>> {
  if (!platformAdminCan(actor, 'tenant.lifecycle.manage')) return err('Not authorized')
  if (!UUID.test(input.restaurantId)) return err('Invalid tenant id')
  if (!isTenantServiceStatus(input.status)) return err('Invalid service status')
  if (!UUID.test(input.requestId)) return err('Invalid request id')
  const reason = input.reason.trim()
  if (reason.length < 10 || reason.length > 1000) return err('Invalid operation reason')

  const result = await port.setServiceStatus({
    restaurantId: input.restaurantId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    status: input.status,
    reason,
    requestId: input.requestId,
  })
  return result.ok ? result : err('Tenant service status could not be changed')
}
