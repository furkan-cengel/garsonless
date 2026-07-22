import type {
  PlatformAdminIdentity,
  PlatformAdminIdentityPort,
} from '@garsonless/application/platform-admin'
import { isPlatformAdminRole } from '@garsonless/domain/platform-admin'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'

type RpcResult = { data: unknown; error: { message: string } | null }
export type PlatformAdminIdentityRpc = (
  name: 'read_platform_admin_identity',
  args: { p_user_id: string },
) => PromiseLike<RpcResult>

function parseIdentity(value: unknown): PlatformAdminIdentity | null {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid platform admin identity')
  }
  const row = value as Record<string, unknown>
  if (
    typeof row.userId !== 'string'
    || !isPlatformAdminRole(row.role)
    || !['invited', 'active', 'suspended', 'revoked'].includes(String(row.status))
    || !(row.displayName === null || typeof row.displayName === 'string')
  ) {
    throw new Error('invalid platform admin identity')
  }
  return {
    userId: row.userId,
    role: row.role,
    status: row.status as PlatformAdminIdentity['status'],
    displayName: row.displayName,
  }
}

export function createPlatformAdminIdentityPort(
  rpc?: PlatformAdminIdentityRpc,
): PlatformAdminIdentityPort {
  return {
    async readIdentity(userId) {
      try {
        const service = rpc ? null : createServiceClient()
        const call = rpc ?? (service!.rpc.bind(service) as unknown as PlatformAdminIdentityRpc)
        const { data, error } = await call('read_platform_admin_identity', { p_user_id: userId })
        if (error) return err('platform_admin_identity_query_failed')
        return ok(parseIdentity(data))
      } catch {
        return err('platform_admin_identity_query_failed')
      }
    },
  }
}
