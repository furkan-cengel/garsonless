import { cache } from 'react'
import type { Tables } from '@garsonless/db/types'
import {
  readMenuManagement,
} from '@garsonless/application/menu'
import {
  createMenuManagementReadModelPort,
  listMenuItemRecommendations,
  type MenuItemRecommendationRow,
} from '@garsonless/db/server'
import { getDashboardFeatureContext } from './context'

interface MenuManagementData {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  recommendations: MenuItemRecommendationRow[]
}

export type MenuManagementResult =
  | { ok: true; data: MenuManagementData }
  | { ok: false; error: string }

const menuReadModel = createMenuManagementReadModelPort()

/** Dashboard menu loader. A failed query is never converted into an empty
 * menu, which would mislead operators into thinking their products vanished. */
export const getMenuManagementData = cache(async function getMenuManagementData(
  restaurantId: string,
): Promise<MenuManagementResult> {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) return { ok: false, error: 'Not authorized' }
  const result = await readMenuManagement(context, restaurantId, menuReadModel)
  if (!result.ok) return { ok: false, error: result.error }
  try {
    const recommendations = await listMenuItemRecommendations(restaurantId)
    return { ok: true, data: { ...result.value, recommendations } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ürün önerileri yüklenemedi.' }
  }
})
