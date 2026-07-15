import { notFound } from 'next/navigation'
import { getRestaurantById, getTablesForRestaurant } from '../../../../lib/queries'
import TablesBuilderShell from '../../../../components/tables/TablesBuilderShell'
import { requireSection } from '../../../../lib/auth/access'
import { getOpenTableSessions } from '../../../../lib/actions/tables'
import { listActiveTableQrTokens } from '@garsonless/db/server'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function TablesPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'tables')
  const [restaurant, tables, openSessionsResult, qrTokens] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
    getOpenTableSessions(restaurantId),
    listActiveTableQrTokens(restaurantId),
  ])
  if (!restaurant) notFound()

  return (
    <TablesBuilderShell
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      initialTables={tables}
      initialQrTokens={qrTokens}
      initialOpenSessions={Array.isArray(openSessionsResult) ? openSessionsResult : []}
      initialSessionError={Array.isArray(openSessionsResult) ? null : openSessionsResult.error}
      initialQRStyle={(restaurant.settings as Record<string, unknown> | null)?.qr_style ?? null}
    />
  )
}
