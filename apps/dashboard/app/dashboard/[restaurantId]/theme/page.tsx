import { notFound, redirect } from 'next/navigation'
import { TEMPLATES } from '@garsonless/design-engine'
import { getRestaurantById } from '../../../../lib/queries'
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
  const configuredTemplateId = typeof settings?.['active_template_id'] === 'string'
    ? settings['active_template_id']
    : 'default'
  const activeTemplateId = TEMPLATES[configuredTemplateId] ? configuredTemplateId : 'default'

  redirect(`/dashboard/${restaurantId}/theme/${activeTemplateId}/edit`)
}
