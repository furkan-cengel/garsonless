import type { MenuBulkPort } from '@garsonless/application/menu-bulk'
import type { MenuBulkResult } from '@garsonless/domain/menu-bulk'
import { createServiceClient } from './service-client'

export function createMenuBulkPort(): MenuBulkPort {
  return {
    async execute(input) {
      const client = createServiceClient()
      const rpc = client.rpc.bind(client) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
      const { data, error } = await rpc('execute_menu_bulk', {
        p_restaurant_id: input.restaurantId, p_actor_id: input.actorId, p_mode: input.mode,
        p_request_id: input.requestId ?? null, p_operation_id: input.operationId ?? null,
        p_patches: input.patches ?? [], p_offset: input.offset ?? 0,
      })
      if (error || !data) return { ok: false, error: 'unavailable' }
      return data as MenuBulkResult
    },
  }
}
