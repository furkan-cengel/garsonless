import { notFound } from 'next/navigation'
import { getRestaurantById, getTablesForRestaurant } from '../../../../lib/queries'
import TablesBuilderShell from '../../../../components/tables/TablesBuilderShell'
import { requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function TablesPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'tables')
  const [restaurant, tables] = await Promise.all([
    getRestaurantById(restaurantId),
    getTablesForRestaurant(restaurantId),
  ])
  if (!restaurant) notFound()

  return (
    <TablesBuilderShell
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      initialTables={tables}
      initialQRStyle={(restaurant.settings as Record<string, unknown> | null)?.qr_style ?? null}
    />
  )
}
