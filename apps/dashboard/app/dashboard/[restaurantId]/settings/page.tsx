import { notFound, redirect } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { firstPermittedPath, type Section } from '../../../../lib/auth/access'
import { getDashboardAuthenticatedUser, getDashboardFeatureContext } from '../../../../lib/queries/context'
import { readDashboardSettings } from '@garsonless/application/settings'
import { createDashboardSettingsReadModelPort } from '@garsonless/db/server'
import SettingsForm from '../../../../components/settings/SettingsForm'

interface Props {
  params: Promise<{ restaurantId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { restaurantId } = await params
  const [restaurant, user, actor] = await Promise.all([
    getRestaurantById(restaurantId),
    getDashboardAuthenticatedUser(),
    getDashboardFeatureContext(restaurantId),
  ])
  if (!restaurant || !actor) notFound()
  if (!actor.isOwner && !actor.permissions.includes('settings')) {
    redirect(firstPermittedPath(restaurantId, {
      isOwner: false,
      isMember: true,
      permissions: [...actor.permissions] as Section[],
    }))
  }
  const settings = await readDashboardSettings(actor, restaurantId, createDashboardSettingsReadModelPort())
  if (!settings.ok) throw new Error(settings.error)

  return (
    <SettingsForm
      restaurant={restaurant}
      user={user}
      hasKitchenAccess={settings.value.hasKitchenAccess}
      kitchenStations={settings.value.kitchenStations}
      securityEvents={settings.value.securityEvents}
      isOwner={actor.isOwner === true}
      teamMembers={settings.value.teamMembers}
    />
  )
}
