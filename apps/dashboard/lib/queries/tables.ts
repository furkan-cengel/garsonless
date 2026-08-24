import { cache } from 'react'
import { readDashboardTables } from '@garsonless/application/tables'
import { createDashboardTablesReadModelPort } from '@garsonless/db/server'
import type { Tables } from '@garsonless/db/types'
import { getDashboardFeatureContext } from './context'

const tablesReadModel = createDashboardTablesReadModelPort()
export type TablesDirectoryResult =
  | { ok: true; tables: Tables<'tables'>[] }
  | { ok: false; tables: []; error: string }

export const getTablesForRestaurant = cache(async function getTablesForRestaurant(restaurantId: string) {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) {
    return {
      ok: false,
      tables: [],
      error: 'Masa listesi yüklenemedi. Erişiminizi kontrol edip tekrar deneyin.',
    } satisfies TablesDirectoryResult
  }
  const result = await readDashboardTables(context, restaurantId, tablesReadModel)
  return result.ok
    ? { ok: true, tables: result.value } satisfies TablesDirectoryResult
    : {
        ok: false,
        tables: [],
        error: 'Masa listesi yüklenemedi. Lütfen tekrar deneyin.',
      } satisfies TablesDirectoryResult
})
