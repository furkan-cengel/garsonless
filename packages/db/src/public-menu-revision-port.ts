import type {
  PublicMenuRevisionPort,
  PublicMenuRevisionSnapshot,
} from '@garsonless/application/public-menu-cache'
import { createServiceClient } from './service-client'

export function createPublicMenuRevisionPort(): PublicMenuRevisionPort {
  return {
    async readRevision(restaurantId): Promise<PublicMenuRevisionSnapshot> {
      const { data, error } = await createServiceClient()
        .from('menu_invalidations')
        .select('restaurant_id, version, updated_at')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (error) throw error
      return {
        restaurantId,
        revision: data?.version ?? 0,
        updatedAt: data?.updated_at ?? null,
      }
    },
  }
}
