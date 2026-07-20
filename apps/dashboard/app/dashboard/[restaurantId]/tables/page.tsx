import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { getTablesForRestaurant } from '../../../../lib/queries/tables'
import TablesBuilderShell from '../../../../components/tables/TablesBuilderShell'
import { assertAccess, requireSection } from '../../../../lib/auth/access'
import { getOpenTableSessions } from '../../../../lib/actions/tables'
import { listDashboardTableQrTokens } from '@garsonless/application/tables'
import { createDashboardTablePort } from '@garsonless/db/server'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function TablesPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'tables')
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) notFound()
  const qrTokensResult = listDashboardTableQrTokens(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    restaurantId,
    createDashboardTablePort(),
  )
  const [restaurant, tables, openSessionsResult, qrTokens] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
    getOpenTableSessions(restaurantId),
    qrTokensResult,
  ])
  if (!restaurant) notFound()

  return (
    <TablesBuilderShell
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      initialTables={tables}
      initialQrTokens={qrTokens.ok ? qrTokens.value : {}}
      initialOpenSessions={Array.isArray(openSessionsResult) ? openSessionsResult : []}
      initialSessionError={Array.isArray(openSessionsResult) ? null : openSessionsResult.error}
      initialQRStyle={(restaurant.settings as Record<string, unknown> | null)?.qr_style ?? null}
    />
  )
}
