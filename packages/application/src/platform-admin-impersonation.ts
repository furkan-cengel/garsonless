import {
  platformAdminCan,
  type PlatformAdminActorContext,
  type PlatformAdminRole,
} from '@garsonless/domain/platform-admin'
import { err, type Result } from '@garsonless/domain/result'

export const PLATFORM_IMPERSONATION_DURATIONS = [15, 30, 60] as const
export type PlatformImpersonationDuration = typeof PLATFORM_IMPERSONATION_DURATIONS[number]

export type PlatformImpersonationSession = {
  id: string
  restaurantId: string
  actorUserId: string
  actorRole: Exclude<PlatformAdminRole, 'finance'>
  reason: string
  startedAt: string
  expiresAt: string
  endedAt: string | null
  status: 'active' | 'ended' | 'expired'
}

export type PlatformImpersonationMutationResult = {
  session: PlatformImpersonationSession
  duplicate: boolean
  requestId: string
}

export interface PlatformImpersonationPort {
  readSession(input: {
    sessionId: string
    actorUserId: string
    actorRole: PlatformAdminRole
  }): Promise<Result<PlatformImpersonationSession | null>>
  startSession(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminRole
    durationMinutes: PlatformImpersonationDuration
    reason: string
    requestId: string
  }): Promise<Result<PlatformImpersonationMutationResult>>
  endSession(input: {
    sessionId: string
    actorUserId: string
    actorRole: PlatformAdminRole
    reason: string
    requestId: string
  }): Promise<Result<PlatformImpersonationMutationResult>>
}

export type PlatformImpersonationError =
  | 'Not authorized'
  | 'Invalid tenant id'
  | 'Invalid session id'
  | 'Invalid duration'
  | 'Invalid operation reason'
  | 'Invalid request id'
  | 'Impersonation session could not be loaded'
  | 'Impersonation session could not be changed'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function canImpersonate(actor: PlatformAdminActorContext): boolean {
  return actor.role !== 'finance' && platformAdminCan(actor, 'impersonation.read')
}

function validReason(reason: string): string | null {
  const normalized = reason.trim()
  return normalized.length >= 10 && normalized.length <= 1000 ? normalized : null
}

export async function readPlatformImpersonationSession(
  actor: PlatformAdminActorContext,
  sessionId: string,
  port: PlatformImpersonationPort,
): Promise<Result<PlatformImpersonationSession | null, PlatformImpersonationError>> {
  if (!canImpersonate(actor)) return err('Not authorized')
  if (!UUID.test(sessionId)) return err('Invalid session id')
  const result = await port.readSession({
    sessionId,
    actorUserId: actor.userId,
    actorRole: actor.role,
  })
  return result.ok ? result : err('Impersonation session could not be loaded')
}

export async function startPlatformImpersonationSession(
  actor: PlatformAdminActorContext,
  input: {
    restaurantId: string
    durationMinutes: PlatformImpersonationDuration
    reason: string
    requestId: string
  },
  port: PlatformImpersonationPort,
): Promise<Result<PlatformImpersonationMutationResult, PlatformImpersonationError>> {
  if (!canImpersonate(actor)) return err('Not authorized')
  if (!UUID.test(input.restaurantId)) return err('Invalid tenant id')
  if (!PLATFORM_IMPERSONATION_DURATIONS.includes(input.durationMinutes)) return err('Invalid duration')
  if (!UUID.test(input.requestId)) return err('Invalid request id')
  const reason = validReason(input.reason)
  if (!reason) return err('Invalid operation reason')
  const result = await port.startSession({
    restaurantId: input.restaurantId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    durationMinutes: input.durationMinutes,
    reason,
    requestId: input.requestId,
  })
  return result.ok ? result : err('Impersonation session could not be changed')
}

export async function endPlatformImpersonationSession(
  actor: PlatformAdminActorContext,
  input: { sessionId: string; reason: string; requestId: string },
  port: PlatformImpersonationPort,
): Promise<Result<PlatformImpersonationMutationResult, PlatformImpersonationError>> {
  if (!canImpersonate(actor)) return err('Not authorized')
  if (!UUID.test(input.sessionId)) return err('Invalid session id')
  if (!UUID.test(input.requestId)) return err('Invalid request id')
  const reason = validReason(input.reason)
  if (!reason) return err('Invalid operation reason')
  const result = await port.endSession({
    sessionId: input.sessionId,
    actorUserId: actor.userId,
    actorRole: actor.role,
    reason,
    requestId: input.requestId,
  })
  return result.ok ? result : err('Impersonation session could not be changed')
}
