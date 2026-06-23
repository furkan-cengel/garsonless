import { notFound } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries'
import ThemeLibraryClient from '../../../../components/theme/ThemeLibraryClient'
import { requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function ThemePage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'theme')
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) notFound()

  const settings = restaurant.settings as Record<string, unknown> | null
  const activeTemplateId = typeof settings?.['active_template_id'] === 'string'
    ? settings['active_template_id']
    : 'default'

  return (
    <ThemeLibraryClient
      restaurantId={restaurantId}
      activeTemplateId={activeTemplateId}
    />
  )
}
