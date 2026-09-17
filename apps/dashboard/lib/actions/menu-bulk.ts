'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { executeMenuBulk, type MenuBulkRequest } from '@garsonless/application/menu-bulk'
import { createMenuBulkPort } from '@garsonless/db/server'
import type { MenuBulkResult } from '@garsonless/domain/menu-bulk'
import { assertAccess } from '../auth/access'

const requestSchema = z.object({
  restaurantId: z.string().uuid(),
  mode: z.enum(['preview', 'apply', 'history', 'detail', 'undo', 'snapshot']),
  requestId: z.string().uuid().optional(), operationId: z.string().uuid().optional(),
  offset: z.number().int().min(0).max(100000).optional(),
  patches: z.array(z.object({
    id: z.string().uuid(), expectedUpdatedAt: z.string().datetime({ offset: true }),
    changes: z.object({
      name: z.string().min(1).max(100).optional(), description: z.string().max(500).nullable().optional(),
      price: z.number().finite().min(.01).max(99999999.99).optional(),
      category_id: z.string().uuid().optional(), is_available: z.boolean().optional(),
    }).strict(),
  }).strict()).max(500).optional(),
}).strict()

export async function menuBulkAction(request: MenuBulkRequest): Promise<MenuBulkResult> {
  const parsed = requestSchema.safeParse(request)
  if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data), 'utf8') > 700000) return { ok: false, error: 'invalid_request' }
  const gate = await assertAccess(parsed.data.restaurantId, 'menu')
  if ('error' in gate) return { ok: false, error: 'forbidden' }
  const result = await executeMenuBulk({
    actor: 'dashboard-member', restaurantId: parsed.data.restaurantId,
    userId: gate.userId, permissions: ['menu'],
  }, parsed.data, createMenuBulkPort())
  if (result.ok && (request.mode === 'apply' || request.mode === 'undo')) {
    revalidatePath(`/dashboard/${request.restaurantId}/menu`)
    revalidateTag(`menu:${request.restaurantId}`)
  }
  return result
}
