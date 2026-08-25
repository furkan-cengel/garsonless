import type {
  PlatformImpersonationMutationResult,
  PlatformImpersonationPort,
  PlatformImpersonationSession,
} from '@garsonless/application/platform-admin-impersonation'
import { PLATFORM_ADMIN_ROLES } from '@garsonless/domain/platform-admin'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformImpersonationRpc = (
  name:
    | 'read_platform_admin_impersonation_session'
    | 'start_platform_admin_impersonation_session'
    | 'end_platform_admin_impersonation_session',
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

function nullableTimestamp(value: unknown): string | null {
  return value === null ? null : timestamp(value)
}

function parseSession(value: unknown): PlatformImpersonationSession {
  const row = record(value)
  if (
    typeof row.id !== 'string' || !UUID.test(row.id)
    || typeof row.restaurantId !== 'string' || !UUID.test(row.restaurantId)
    || typeof row.actorUserId !== 'string' || !UUID.test(row.actorUserId)
    || !PLATFORM_ADMIN_ROLES.includes(row.actorRole as never) || row.actorRole === 'finance'
    || typeof row.reason !== 'string' || row.reason.trim().length < 10
    || !['active', 'ended', 'expired'].includes(String(row.status))
  ) throw new Error('invalid impersonation session')
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole as PlatformImpersonationSession['actorRole'],
    reason: row.reason,
    startedAt: timestamp(row.startedAt),
    expiresAt: timestamp(row.expiresAt),
    endedAt: nullableTimestamp(row.endedAt),
    status: row.status as PlatformImpersonationSession['status'],
  }
}

function parseMutation(value: unknown): PlatformImpersonationMutationResult {
  const row = record(value)
  if (
    typeof row.duplicate !== 'boolean'
    || typeof row.requestId !== 'string' || !UUID.test(row.requestId)
  ) throw new Error('invalid impersonation mutation')
  return {
    session: parseSession(row.session),
    duplicate: row.duplicate,
    requestId: row.requestId,
  }
}

function serviceRpc(): PlatformImpersonationRpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as PlatformImpersonationRpc
}

export function createPlatformAdminImpersonationPort(
  rpc: PlatformImpersonationRpc = serviceRpc(),
): PlatformImpersonationPort {
  return {
    async readSession(input) {
      try {
        const { data, error } = await rpc('read_platform_admin_impersonation_session', {
          p_session_id: input.sessionId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
        })
        if (error) return err('platform_impersonation_read_failed')
        return ok(data === null ? null : parseSession(data))
      } catch {
        return err('platform_impersonation_read_failed')
      }
    },
    async startSession(input) {
      try {
        const { data, error } = await rpc('start_platform_admin_impersonation_session', {
          p_restaurant_id: input.restaurantId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
          p_duration_minutes: input.durationMinutes,
          p_reason: input.reason,
          p_request_id: input.requestId,
        })
        if (error) return err('platform_impersonation_start_failed')
        return ok(parseMutation(data))
      } catch {
        return err('platform_impersonation_start_failed')
      }
    },
    async endSession(input) {
      try {
        const { data, error } = await rpc('end_platform_admin_impersonation_session', {
          p_session_id: input.sessionId,
          p_actor_user_id: input.actorUserId,
          p_actor_role: input.actorRole,
          p_reason: input.reason,
          p_request_id: input.requestId,
        })
        if (error) return err('platform_impersonation_end_failed')
        return ok(parseMutation(data))
      } catch {
        return err('platform_impersonation_end_failed')
      }
    },
  }
}
