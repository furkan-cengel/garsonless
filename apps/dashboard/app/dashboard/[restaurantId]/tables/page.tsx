import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { getTablesForRestaurant } from '../../../../lib/queries/tables'
import TablesOperationsClientLoader from '../../../../components/tables/TablesOperationsClientLoader'
import { requireSection } from '../../../../lib/auth/access'
import { getOpenTableSessions, getTableLayout } from '../../../../lib/actions/tables'
import { resolveTableDeepLink } from '../../../../components/tables/tables-operation-model'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'
import { readBillingPlanPrices } from '../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<{ tableId?: string | string[] }>
}

export default async function TablesPage({ params, searchParams }: Props) {
  const [{ restaurantId }, query] = await Promise.all([params, searchParams])
  const access = await requireSection(restaurantId, 'tables')
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'table_management' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="table_management" isOwner={access.isOwner} planPrices={readBillingPlanPrices()} />
  }
  const [tablesResult, openSessionsResult, layoutResult] = await Promise.all([
    getTablesForRestaurant(restaurantId),
    getOpenTableSessions(restaurantId),
    getTableLayout(restaurantId),
  ])
  const tables = tablesResult.tables
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
    <TablesOperationsClientLoader
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      initialTables={tables}
      initialDirectoryError={tablesResult.ok ? null : tablesResult.error}
      initialOpenSessions={Array.isArray(openSessionsResult) ? openSessionsResult : []}
      initialSessionError={Array.isArray(openSessionsResult) ? null : openSessionsResult.error}
      initialLayoutSnapshot={layoutSnapshot ?? layoutFallback}
      initialLayoutError={layoutError}
      initialNow={Date.now()}
      initialTableId={initialTableId}
    />
  )
}
