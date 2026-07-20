import { cache } from 'react'
import { readDashboardTables } from '@garsonless/application/tables'
import { createDashboardTablesReadModelPort } from '@garsonless/db/server'
import { getDashboardFeatureContext } from './context'

const tablesReadModel = createDashboardTablesReadModelPort()

export const getTablesForRestaurant = cache(async function getTablesForRestaurant(restaurantId: string) {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) return []
  const result = await readDashboardTables(context, restaurantId, tablesReadModel)
  return result.ok ? result.value : []
})
