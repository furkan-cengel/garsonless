import { notFound } from 'next/navigation'
import { getMenuManagementData, getRestaurantById } from '../../../../lib/queries'
import MenuManager from '../../../../components/menu/MenuManager'
import MenuLoadError from '../../../../components/menu/MenuLoadError'
import { requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function MenuPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'menu')
  const [restaurant, menuResult] = await Promise.all([
    getRestaurantById(restaurantId),
    getMenuManagementData(restaurantId),
  ])
  if (!restaurant) notFound()
  if (!menuResult.ok) return <MenuLoadError message={menuResult.error} />

  const { categories, items, kitchenStations } = menuResult.data

  return (
    <MenuManager
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      initialCategories={categories}
      initialItems={items}
      kitchenStations={kitchenStations}
    />
  )
}
