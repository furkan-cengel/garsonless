import type { DashboardActorContext } from '@garsonless/domain/context'
import { validateMenuBulkPatches, type MenuBulkPatch, type MenuBulkResult } from '@garsonless/domain/menu-bulk'

export type MenuBulkRequest = {
  restaurantId: string
  mode: 'preview' | 'apply' | 'history' | 'detail' | 'undo' | 'snapshot'
  requestId?: string
  operationId?: string
  patches?: MenuBulkPatch[]
  offset?: number
}
export interface MenuBulkPort {
  execute(input: MenuBulkRequest & { actorId: string }): Promise<MenuBulkResult>
}
export async function executeMenuBulk(context: DashboardActorContext, input: MenuBulkRequest, port: MenuBulkPort): Promise<MenuBulkResult> {
  if (context.restaurantId !== input.restaurantId || !context.permissions.includes('menu')) return { ok: false, error: 'forbidden' }
  if (input.mode === 'apply' || input.mode === 'preview') {
    const invalid = validateMenuBulkPatches(input.patches ?? [])
    if (invalid) return { ok: false, error: invalid }
  }
  if ((input.mode === 'apply' || input.mode === 'undo') && !input.requestId) return { ok: false, error: 'invalid_request' }
  if ((input.mode === 'undo' || input.mode === 'detail') && !input.operationId) return { ok: false, error: 'invalid_request' }
  return port.execute({ ...input, actorId: context.userId })
}
