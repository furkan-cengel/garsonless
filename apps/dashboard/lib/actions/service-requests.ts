'use server'

import { revalidatePath } from 'next/cache'
import { assertAccess } from '../auth/access'
import {
  listPendingTableServiceRequests,
  resolveTableServiceRequest,
} from '@garsonless/application/tables'
import { createTableServiceRequestPort } from '@garsonless/db/server'

export type PendingServiceRequest = import('@garsonless/application/tables').PendingTableServiceRequest

export async function getPendingServiceRequests(
  restaurantId: string,
): Promise<PendingServiceRequest[] | { error: string }> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }
  const result = await listPendingTableServiceRequests(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    restaurantId,
    createTableServiceRequestPort(),
  )
  return result.ok ? result.value : { error: result.error }
}

export async function resolveServiceRequest(
  requestId: string,
  restaurantId: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) return { error: gate.error }
  const result = await resolveTableServiceRequest(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    { requestId, restaurantId },
    createTableServiceRequestPort(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/${restaurantId}/tables`)
  return { success: true }
}
