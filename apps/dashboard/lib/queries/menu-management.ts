import { cache } from 'react'
import type { Tables } from '@garsonless/db/types'
import {
  readMenuKitchenStations,
  readMenuManagement,
} from '@garsonless/application/menu'
import { createMenuManagementReadModelPort } from '@garsonless/db/server'
import { getDashboardFeatureContext } from './context'

export interface MenuManagementData {
  categories: Tables<'menu_categories'>[]
  items: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
}

export type MenuManagementResult =
  | { ok: true; data: MenuManagementData }
  | { ok: false; error: string }

const menuReadModel = createMenuManagementReadModelPort()

export const getKitchenStationsForRestaurant = cache(async function getKitchenStationsForRestaurant(
  restaurantId: string,
) {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) return []
  const result = await readMenuKitchenStations(context, restaurantId, menuReadModel)
  return result.ok ? result.value : []
})

/** Dashboard menu loader. A failed query is never converted into an empty
 * menu, which would mislead operators into thinking their products vanished. */
export const getMenuManagementData = cache(async function getMenuManagementData(
  restaurantId: string,
): Promise<MenuManagementResult> {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) return { ok: false, error: 'Not authorized' }
  const result = await readMenuManagement(context, restaurantId, menuReadModel)
  return result.ok
    ? { ok: true, data: result.value }
    : { ok: false, error: result.error }
})
