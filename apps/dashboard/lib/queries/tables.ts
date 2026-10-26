import { cache } from 'react'
import { readDashboardTables } from '@garsonless/application/tables'
import { createDashboardTablesReadModelPort } from '@garsonless/db/server'
import type { Tables } from '@garsonless/db/types'
import { createActionFailure } from '@garsonless/domain/errors'
import { getDashboardFeatureContext } from './context'

const tablesReadModel = createDashboardTablesReadModelPort()
export type TablesDirectoryResult =
  | { ok: true; tables: Tables<'tables'>[] }
  | { ok: false; tables: []; error: string; code: string }

/** A failed read carries a support code (MAS-*) so the empty plan can show what went wrong. */
function directoryFailure(error: string, code: 'ACCESS_DENIED' | 'SERVICE_UNAVAILABLE'): TablesDirectoryResult {
  return { ok: false, tables: [], error, code: createActionFailure(code).publicCode }
}

export const getTablesForRestaurant = cache(async function getTablesForRestaurant(restaurantId: string) {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) return directoryFailure('Masa listesi yüklenemedi. Erişiminizi kontrol edip tekrar deneyin.', 'ACCESS_DENIED')
  const result = await readDashboardTables(context, restaurantId, tablesReadModel)
  return result.ok
    ? { ok: true, tables: result.value } satisfies TablesDirectoryResult
    : directoryFailure('Masa listesi yüklenemedi. Lütfen tekrar deneyin.', 'SERVICE_UNAVAILABLE')
})
