'use server'

import { z } from 'zod'
import { requestQrStands, type StandType } from '@garsonless/application/restaurants'
import { createStandRequestPort } from '@garsonless/db/server'
import { assertAccess } from '../auth/access'
import { createStandRequestNotificationPort } from '../stand-request-notification-port'

const requestStandsSchema = z.object({
  contactName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  tableCount: z.coerce.number().int().min(1).max(500),
  standType: z.enum(['basic', 'premium', 'custom']),
  notes: z.string().max(500).optional(),
})

export type { StandType }

export async function requestStands(
  restaurantId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const restaurantIdResult = z.string().uuid().safeParse(restaurantId)
  if (!restaurantIdResult.success) return { error: 'Invalid restaurant' }

  const gate = await assertAccess(restaurantIdResult.data, 'tables')
  if ('error' in gate) return { error: gate.error }

  const parsed = requestStandsSchema.safeParse({
    contactName: formData.get('contactName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    tableCount: formData.get('tableCount'),
    standType: formData.get('standType'),
    notes: formData.get('notes'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const result = await requestQrStands(
    {
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId: restaurantIdResult.data,
      permissions: ['tables'],
    },
    { restaurantId: restaurantIdResult.data, ...parsed.data },
    createStandRequestPort(),
    createStandRequestNotificationPort(),
  )
  if (!result.ok) return { error: result.error }
  return { success: true }
}
