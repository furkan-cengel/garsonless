import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { getTablesForRestaurant } from '../../../../lib/queries/tables'
import TablesOperationsShell from '../../../../components/tables/TablesOperationsShell'
import { assertAccess, requireSection } from '../../../../lib/auth/access'
import { getOpenTableSessions, getTableLayout } from '../../../../lib/actions/tables'
import { resolveTableDeepLink } from '../../../../components/tables/tables-operation-model'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<{ tableId?: string | string[] }>
}

export default async function TablesPage({ params, searchParams }: Props) {
  const [{ restaurantId }, query] = await Promise.all([params, searchParams])
  await requireSection(restaurantId, 'tables')
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) notFound()
  const [restaurant, tables, openSessionsResult, layoutResult] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
    getOpenTableSessions(restaurantId),
    getTableLayout(restaurantId),
  ])
  if (!restaurant) notFound()
  const layoutFallback = {
    revision: restaurant.table_layout_revision,
    initializedAt: restaurant.table_layout_initialized_at,
    entries: tables.map((table) => ({
      tableId: table.id,
      xBp: table.layout_x_bp,
      yBp: table.layout_y_bp,
      shape: table.layout_shape === 'square' ? 'square' as const : 'rectangle' as const,
      rotation: table.layout_rotation === 90 ? 90 as const : 0 as const,
      seatCount: table.seat_count,
    })),
  }
  const layoutError = layoutResult && 'error' in layoutResult
    ? 'Salon yerleşimi yüklenemedi. Düzenleme geçici olarak kapatıldı.'
    : null
  const layoutSnapshot = layoutResult && !('error' in layoutResult)
    ? layoutResult
    : layoutFallback
  const initialTableId = resolveTableDeepLink(query.tableId, tables)

  return (
    <TablesOperationsShell
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initialTables={tables}
      initialOpenSessions={Array.isArray(openSessionsResult) ? openSessionsResult : []}
      initialSessionError={Array.isArray(openSessionsResult) ? null : openSessionsResult.error}
      initialLayoutSnapshot={layoutSnapshot ?? layoutFallback}
      initialLayoutError={layoutError}
      initialNow={Date.now()}
      initialTableId={initialTableId}
    />
  )
}
