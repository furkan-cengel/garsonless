'use server'

import { z } from 'zod'
import {
  createTenantPrivacyExport,
  requestTenantPrivacyOperation,
} from '@garsonless/db/server'
import { requireFreshOwnerPassword } from '../auth/fresh-owner-auth'

const privacyRequestSchema = z.object({
  operationType: z.enum(['export', 'account_deletion_request', 'restaurant_deletion_request']),
  reason: z.string().trim().min(3).max(500),
  currentPassword: z.string().min(1).max(256),
  requestId: z.string().uuid(),
}).strict()

export async function createPrivacyOperation(
  restaurantId: string,
  input: unknown,
): Promise<
  | { error: string }
  | { success: true; operationId: string; status: string; duplicate: boolean; filename?: string; content?: string; digest?: string }
> {
  const parsed = privacyRequestSchema.safeParse(input)
  if (!parsed.success) return { error: 'Geçerli gerekçe ve hesap şifresi gerekli.' }
  const gate = await requireFreshOwnerPassword(restaurantId, parsed.data.currentPassword)
  if (!gate.ok) return { error: gate.error }

  if (parsed.data.operationType === 'export') {
    const exported = await createTenantPrivacyExport({
      restaurantId,
      actorUserId: gate.userId,
      reason: parsed.data.reason,
      requestId: parsed.data.requestId,
    })
    if (!exported.ok) return { error: 'Veri dışa aktarması hazırlanamadı. Yeni bir istekle tekrar deneyin.' }
    return {
      success: true,
      operationId: exported.value.id,
      status: exported.value.status,
      duplicate: exported.value.duplicate,
      filename: `masabu-veri-disari-aktarma-${restaurantId}-${new Date().toISOString().slice(0, 10)}.json`,
      content: JSON.stringify(exported.value.document, null, 2),
      digest: exported.value.digest,
    }
  }

  const requested = await requestTenantPrivacyOperation({
    restaurantId,
    actorUserId: gate.userId,
    operationType: parsed.data.operationType,
    reason: parsed.data.reason,
    requestId: parsed.data.requestId,
  })
  if (!requested.ok) return { error: 'Talep oluşturulamadı. Lütfen tekrar deneyin.' }
  return {
    success: true,
    operationId: requested.value.id,
    status: requested.value.status,
    duplicate: requested.value.duplicate,
  }
}
