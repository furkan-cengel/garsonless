import { notFound } from 'next/navigation'
import { listDashboardTableQrTokens } from '@garsonless/application/tables'
import { canRestaurantUseFeature, createDashboardTablePort } from '@garsonless/db/server'
import TablesBuilderClientLoader from '../../../../../components/tables/TablesBuilderClientLoader'
import { requireSection } from '../../../../../lib/auth/access'
import { getRestaurantById } from '../../../../../lib/queries/restaurants'
import { getTablesForRestaurant } from '../../../../../lib/queries/tables'
import PlanLockedPanel from '../../../../../components/PlanLockedPanel'
import { readBillingPlanPrices } from '../../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function TablesQRStudioPage({ params }: Props) {
  const { restaurantId } = await params
  const access = await requireSection(restaurantId, 'tables')
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()
  if (!await canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'qr_studio' })) {
    return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="qr_studio" isOwner={access.isOwner} planPrices={readBillingPlanPrices()} />
  }
  const [tablesResult, qrTokens, tableOperationsAllowed] = await Promise.all([
    getTablesForRestaurant(restaurantId),
    listDashboardTableQrTokens(
      { actor: 'dashboard-member', restaurantId, userId: access.userId, permissions: ['tables'] },
      restaurantId,
      createDashboardTablePort(),
    ),
    canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'table_management' }),
  ])

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
      tableOperationsAllowed={tableOperationsAllowed}
    />
  )
}
