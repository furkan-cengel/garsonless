import { platformAdminCan, type PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import type {
  PlatformPrivacyOperationSummary,
  PlatformPrivacyOperationType,
} from '@garsonless/domain/platform-privacy'
import { err, type Result } from '@garsonless/domain/result'

export const PLATFORM_PRIVACY_ERASE_CONFIRMATION = 'KVKK SİL'

export type PlatformPrivacyOperation = {
  id: string
  restaurantId: string
  type: PlatformPrivacyOperationType
  status: 'completed'
  reason: string
  summary: PlatformPrivacyOperationSummary
  requestedBy: string
  requestId: string
  createdAt: string
  completedAt: string
}

export type PlatformTenantPrivacyExport = {
  schemaVersion: 1
  generatedAt: string
  tenant: { id: string; name: string; slug: string; createdAt: string }
  customers: Array<{
    id: string
    name: string | null
    email: string | null
    phone: string | null
    verifiedAt: string | null
    consents: unknown[]
    orders: unknown[]
    loyalty: unknown[]
    paymentShares: unknown[]
    campaignRecipients: unknown[]
  }>
}

export interface PlatformTenantPrivacyPort {
  readOperations(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
  }): Promise<Result<PlatformPrivacyOperation[]>>
  exportData(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
    reason: string
    requestId: string
  }): Promise<Result<{ operation: PlatformPrivacyOperation; document: PlatformTenantPrivacyExport; duplicate: boolean }>>
  eraseData(input: {
    restaurantId: string
    actorUserId: string
    actorRole: PlatformAdminActorContext['role']
    reason: string
    requestId: string
  }): Promise<Result<{ operation: PlatformPrivacyOperation; duplicate: boolean }>>
}

export type PlatformPrivacyError =
  | 'Not authorized'
  | 'Invalid tenant id'
  | 'Invalid operation reason'
  | 'Invalid request id'
  | 'Invalid erase confirmation'
  | 'Privacy operations could not be loaded'
  | 'Privacy export could not be prepared'
  | 'Privacy erasure could not be completed'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validateMutation(
  actor: PlatformAdminActorContext,
  input: { restaurantId: string; reason: string; requestId: string },
): PlatformPrivacyError | null {
  if (!platformAdminCan(actor, 'data.manage')) return 'Not authorized'
  if (!UUID.test(input.restaurantId)) return 'Invalid tenant id'
  if (!UUID.test(input.requestId)) return 'Invalid request id'
  const length = input.reason.trim().length
  if (length < 10 || length > 1000) return 'Invalid operation reason'
  return null
}

export async function readPlatformTenantPrivacyOperations(
  actor: PlatformAdminActorContext,
  restaurantId: string,
  port: PlatformTenantPrivacyPort,
): Promise<Result<PlatformPrivacyOperation[], PlatformPrivacyError>> {
  if (!platformAdminCan(actor, 'data.manage')) return err('Not authorized')
  if (!UUID.test(restaurantId)) return err('Invalid tenant id')
  const result = await port.readOperations({ restaurantId, actorUserId: actor.userId, actorRole: actor.role })
  return result.ok ? result : err('Privacy operations could not be loaded')
}

export async function exportPlatformTenantPrivacyData(
  actor: PlatformAdminActorContext,
  input: { restaurantId: string; reason: string; requestId: string },
  port: PlatformTenantPrivacyPort,
) {
  const invalid = validateMutation(actor, input)
  if (invalid) return err(invalid)
  const result = await port.exportData({
    ...input,
    reason: input.reason.trim(),
    actorUserId: actor.userId,
    actorRole: actor.role,
  })
  return result.ok ? result : err('Privacy export could not be prepared')
}

export async function erasePlatformTenantPrivacyData(
  actor: PlatformAdminActorContext,
  input: { restaurantId: string; reason: string; requestId: string; confirmation: string },
  port: PlatformTenantPrivacyPort,
) {
  const invalid = validateMutation(actor, input)
  if (invalid) return err(invalid)
  if (input.confirmation !== PLATFORM_PRIVACY_ERASE_CONFIRMATION) return err('Invalid erase confirmation')
  const result = await port.eraseData({
    restaurantId: input.restaurantId,
    reason: input.reason.trim(),
    requestId: input.requestId,
    actorUserId: actor.userId,
    actorRole: actor.role,
  })
  return result.ok ? result : err('Privacy erasure could not be completed')
}
