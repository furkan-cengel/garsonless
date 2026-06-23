import { notFound } from 'next/navigation'
import { getCategoriesForRestaurant, getItemsForRestaurant } from '../../../../lib/queries'
import { getRestaurantById } from '../../../../lib/queries'
import MenuManager from '../../../../components/menu/MenuManager'
import { requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function MenuPage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'menu')
  const [restaurant, categories, items] = await Promise.all([
    getRestaurantById(restaurantId),
    getCategoriesForRestaurant(restaurantId),
    getItemsForRestaurant(restaurantId),
  ])
  if (!restaurant) notFound()

  return (
    <MenuManager
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      restaurantSlug={restaurant.slug}
      initialCategories={categories}
      initialItems={items}
    />
  )
}
