import { notFound, redirect } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { firstPermittedPath, type Section } from '../../../../lib/auth/access'
import { getDashboardAuthenticatedUser, getDashboardFeatureContext } from '../../../../lib/queries/context'
import { readDashboardSettings } from '@garsonless/application/settings'
import { readSubscriptionBillingSettings } from '@garsonless/application/billing'
import {
  createDashboardSettingsReadModelPort,
  createSubscriptionBillingSettingsReadPort,
} from '@garsonless/db/server'
import SettingsForm from '../../../../components/settings/SettingsForm'
import { readBillingPlanPrices } from '../../../../lib/billing/subscription-billing-request'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<{ section?: string; checkout?: string }>
}

export default async function SettingsPage({ params, searchParams }: Props) {
  const { restaurantId } = await params
  const query = await searchParams
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
  const [settings, billing] = await Promise.all([
    readDashboardSettings(actor, restaurantId, createDashboardSettingsReadModelPort()),
    actor.isOwner
      ? readSubscriptionBillingSettings(actor, restaurantId, createSubscriptionBillingSettingsReadPort())
      : Promise.resolve(null),
  ])
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
      teamAuditEvents={settings.value.teamAuditEvents}
      billing={billing?.ok ? billing.value : null}
      billingLoadError={billing && !billing.ok ? billing.error : null}
      billingPlanPrices={readBillingPlanPrices()}
      initialSection={actor.isOwner && query.section === 'billing' ? 'billing' : undefined}
      billingCheckoutState={query.checkout === 'success' ? 'success' : null}
    />
  )
}
