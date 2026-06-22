import { notFound } from 'next/navigation'
import { getRestaurantById, getTablesForRestaurant } from '../../../../lib/queries'
import TablesBuilderShell from '../../../../components/tables/TablesBuilderShell'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function TablesPage({ params }: Props) {
  const { restaurantId } = await params
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
    />
  )
}
