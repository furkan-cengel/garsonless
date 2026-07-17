import { notFound, redirect } from 'next/navigation'
import { readActiveThemeForDashboard } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'
import { assertAccess, requireSection } from '../../../../lib/auth/access'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function ThemePage({ params }: Props) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'theme')
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) notFound()
  const result = await readActiveThemeForDashboard({
    actor: 'dashboard-member',
    userId: gate.userId,
    restaurantId,
    permissions: ['theme'],
  }, { restaurantId }, createThemeApplicationPort())
  if (!result.ok) {
    if (result.error === 'Restaurant not found') notFound()
    throw new Error(result.error)
  }

  redirect(`/dashboard/${restaurantId}/theme/${result.value.templateId}/edit`)
}
