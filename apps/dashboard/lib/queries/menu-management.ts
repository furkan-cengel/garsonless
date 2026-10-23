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
import { sanitizeServerDiagnostic } from '../server-log-redaction'

interface MenuManagementData {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  recommendations: MenuItemRecommendationRow[]
  recommendationsAvailable: boolean
}

export type MenuManagementResult =
  | { ok: true; data: MenuManagementData }
  | { ok: false; error: string; code: 'forbidden' | 'unavailable' }

const menuReadModel = createMenuManagementReadModelPort()

/** Dashboard menu loader. A failed query is never converted into an empty
 * menu, which would mislead operators into thinking their products vanished. */
export const getMenuManagementData = cache(async function getMenuManagementData(
  restaurantId: string,
): Promise<MenuManagementResult> {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) return { ok: false, error: 'Bu menüyü görüntüleme yetkiniz yok.', code: 'forbidden' }
  const result = await readMenuManagement(context, restaurantId, menuReadModel)
  if (!result.ok) {
    console.error('[menu-management-read-failure]', sanitizeServerDiagnostic(result.error))
    return { ok: false, error: 'Menü servisi yanıt vermedi.', code: 'unavailable' }
  }
  try {
    const recommendations = await listMenuItemRecommendations(restaurantId)
    return { ok: true, data: { ...result.value, recommendations, recommendationsAvailable: true } }
  } catch (error) {
    console.error('[menu-recommendations-read-failure]', sanitizeServerDiagnostic(error))
    return {
      ok: true,
      data: { ...result.value, recommendations: [], recommendationsAvailable: false },
    }
  }
})
