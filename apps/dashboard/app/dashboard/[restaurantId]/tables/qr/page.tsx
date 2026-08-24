import { notFound } from 'next/navigation'
import { listDashboardTableQrTokens } from '@garsonless/application/tables'
import { createDashboardTablePort } from '@garsonless/db/server'
import TablesBuilderClientLoader from '../../../../../components/tables/TablesBuilderClientLoader'
import { requireSection } from '../../../../../lib/auth/access'
import { getRestaurantById } from '../../../../../lib/queries/restaurants'
import { getTablesForRestaurant } from '../../../../../lib/queries/tables'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function TablesQRStudioPage({ params }: Props) {
  const { restaurantId } = await params
  const access = await requireSection(restaurantId, 'tables')

  const qrTokensResult = listDashboardTableQrTokens(
    { actor: 'dashboard-member', restaurantId, userId: access.userId, permissions: ['tables'] },
    restaurantId,
    createDashboardTablePort(),
  )
  const [restaurant, tablesResult, qrTokens] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
    qrTokensResult,
  ])
  if (!restaurant) notFound()

  return (
    <TablesBuilderClientLoader
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      initialTables={tablesResult.tables}
      initialDirectoryError={tablesResult.ok ? null : tablesResult.error}
      initialQrTokens={qrTokens.ok ? qrTokens.value : {}}
      initialQRStyle={(restaurant.settings as Record<string, unknown> | null)?.qr_style ?? null}
      initialQRStyleRevision={restaurant.qr_style_revision}
    />
  )
}
