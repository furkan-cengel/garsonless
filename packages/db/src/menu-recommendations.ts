import { createServiceClient } from './client'

export interface MenuItemRecommendationRow {
  sourceItemId: string
  recommendedItemId: string
  position: number
}

export async function listMenuItemRecommendations(
  restaurantId: string,
): Promise<MenuItemRecommendationRow[]> {
  const { data, error } = await createServiceClient()
    .from('menu_item_recommendations')
    .select('source_item_id, recommended_item_id, position')
    .eq('restaurant_id', restaurantId)
    .order('source_item_id')
    .order('position')
  // Additive rollout compatibility: deploys may briefly run before PostgREST
  // sees the new table. Only that exact missing-relation state degrades to an
  // empty optional section; all real query failures remain visible.
  if (error?.code === 'PGRST205') return []
  if (error) throw new Error(`Ürün önerileri yüklenemedi: ${error.message}`)
  return (data ?? []).map((row) => ({
    sourceItemId: row.source_item_id,
    recommendedItemId: row.recommended_item_id,
    position: row.position,
  }))
}
