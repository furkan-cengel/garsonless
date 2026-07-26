import { redirect } from 'next/navigation'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import { requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function ThemePage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'theme')
  redirect(`/dashboard/${restaurantId}/theme/${CANONICAL_THEME_ID}/edit`)
}
