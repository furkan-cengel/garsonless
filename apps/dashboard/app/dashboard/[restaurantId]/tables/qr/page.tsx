import { notFound } from 'next/navigation'
import { listDashboardTableQrTokens } from '@garsonless/application/tables'
import { createDashboardTablePort } from '@garsonless/db/server'
import TablesBuilderShell from '../../../../../components/tables/TablesBuilderShell'
import { assertAccess, requireSection } from '../../../../../lib/auth/access'
import { getRestaurantById } from '../../../../../lib/queries/restaurants'
import { getTablesForRestaurant } from '../../../../../lib/queries/tables'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function TablesQRStudioPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'tables')
  const gate = await assertAccess(restaurantId, 'tables')
  if ('error' in gate) notFound()

  const qrTokensResult = listDashboardTableQrTokens(
    { actor: 'dashboard-member', restaurantId, userId: gate.userId, permissions: ['tables'] },
    restaurantId,
    createDashboardTablePort(),
  )
  const [restaurant, tables, qrTokens] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
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
      initialQRStyle={(restaurant.settings as Record<string, unknown> | null)?.qr_style ?? null}
      initialQRStyleRevision={restaurant.qr_style_revision}
    />
  )
}
