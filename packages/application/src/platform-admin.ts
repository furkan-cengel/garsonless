import {
  isPlatformAdminRole,
  type PlatformAdminActorContext,
  type PlatformAdminRole,
} from '@garsonless/domain/platform-admin'
import { err, ok, type Result } from '@garsonless/domain/result'

export type PlatformAdminIdentity = {
  userId: string
  role: PlatformAdminRole
  status: 'invited' | 'active' | 'suspended' | 'revoked'
  displayName: string | null
}

export interface PlatformAdminIdentityPort {
  readIdentity(userId: string): Promise<Result<PlatformAdminIdentity | null>>
}

export type PlatformAdminAccessError =
  | 'Platform admin identity is invalid'
  | 'Platform admin access is not granted'
  | 'Platform admin access is inactive'
  | 'Platform admin identity could not be loaded'
  | 'Platform admin MFA is required'

function validUserId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function readPlatformAdminIdentity(
  userId: string,
  port: PlatformAdminIdentityPort,
): Promise<Result<PlatformAdminIdentity, PlatformAdminAccessError>> {
  if (!validUserId(userId)) return err('Platform admin identity is invalid')
  const result = await port.readIdentity(userId)
  if (!result.ok) return err('Platform admin identity could not be loaded')
  if (!result.value) return err('Platform admin access is not granted')
  if (result.value.status !== 'active') return err('Platform admin access is inactive')
  if (result.value.userId !== userId || !isPlatformAdminRole(result.value.role)) {
    return err('Platform admin identity could not be loaded')
  }
  return ok(result.value)
}

export async function resolvePlatformAdminActor(
  input: { userId: string; currentAal: 'aal1' | 'aal2' | null },
  port: PlatformAdminIdentityPort,
): Promise<Result<PlatformAdminActorContext, PlatformAdminAccessError>> {
  const identity = await readPlatformAdminIdentity(input.userId, port)
  if (!identity.ok) return identity
  if (input.currentAal !== 'aal2') return err('Platform admin MFA is required')
  return ok({
    actor: 'platform-admin',
    userId: identity.value.userId,
    role: identity.value.role,
    aal: 'aal2',
  })
}
