import { notFound, redirect } from 'next/navigation'
import { getRestaurantById } from '../../../../lib/queries/restaurants'
import { firstPermittedPath, type Section } from '../../../../lib/auth/access'
import { getDashboardAuthenticatedUser, getDashboardFeatureContext } from '../../../../lib/queries/context'
import { readDashboardSettings } from '@garsonless/application/settings'
import type { DashboardSettingsReadScope } from '@garsonless/application/settings'
import type { IntegrationHealth } from '@garsonless/application/settings'
import { readSubscriptionBillingSettings } from '@garsonless/application/billing'
import {
  canRestaurantUseFeature,
  createDashboardSettingsReadModelPort,
  readRestaurantIntegrationHealth,
  createSubscriptionBillingSettingsReadPort,
} from '@garsonless/db/server'
import SettingsForm from '../../../../components/settings/SettingsFormLoader'
import { resolveSettingsSection } from '../../../../components/settings/settings-sections'
import { readBillingPlanPrices } from '../../../../lib/billing/subscription-billing-request'
import PlanLockedPanel from '../../../../components/PlanLockedPanel'

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
  const productAccess = await canRestaurantUseFeature({
    restaurantId,
    plan: restaurant.plan,
    feature: 'qr_menu',
  })
  if (!productAccess) {
    if (!actor.isOwner) {
      return <PlanLockedPanel restaurantId={restaurantId} currentPlan={restaurant.plan} feature="qr_menu" isOwner={false} />
    }
  }
  const requestedSection = resolveSettingsSection(query.section, actor.isOwner === true)
  const continuitySections = new Set(['workspace', 'profile', 'billing', 'security', 'privacy'])
  const initialSection = !productAccess && !continuitySections.has(requestedSection)
    ? 'billing'
    : requestedSection
  if (query.section && query.section !== initialSection) {
    const canonicalQuery = new URLSearchParams()
    canonicalQuery.set('section', initialSection)
    if (query.checkout === 'success' && initialSection === 'billing') canonicalQuery.set('checkout', 'success')
    redirect(`/dashboard/${restaurantId}/settings?${canonicalQuery.toString()}`)
  }
  const settingsScopes: DashboardSettingsReadScope[] = initialSection === 'team'
    ? ['team']
    : initialSection === 'kitchen'
      ? ['kitchen']
      : initialSection === 'security'
        ? ['security']
        : []
  const emptySettings = {
    hasKitchenAccess: false,
    kitchenStations: [],
    teamMembers: [],
    teamAuditEvents: [],
    securityEvents: [],
  }
  const [settings, billing, loyaltyAccess, kitchenDisplayAccess, browserNotificationsAccess, integrationHealthResult] = await Promise.all([
    settingsScopes.length > 0
      ? readDashboardSettings(actor, restaurantId, createDashboardSettingsReadModelPort(), settingsScopes)
      : Promise.resolve({ ok: true as const, value: emptySettings }),
    actor.isOwner && initialSection === 'billing'
      ? readSubscriptionBillingSettings(actor, restaurantId, createSubscriptionBillingSettingsReadPort())
      : Promise.resolve(null),
    initialSection === 'loyalty'
      ? canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'loyalty' })
      : Promise.resolve(false),
    initialSection === 'kitchen'
      ? canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'kitchen_display' })
      : Promise.resolve(false),
    initialSection === 'notifications'
      ? canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'browser_notifications' })
      : Promise.resolve(false),
    actor.isOwner && (initialSection === 'payments' || initialSection === 'api')
      ? readRestaurantIntegrationHealth(restaurantId)
      : Promise.resolve({ ok: true as const, value: [] as IntegrationHealth[] }),
  ])
  const settingsValue = settings.ok ? settings.value : emptySettings

  return (
    <SettingsForm
      restaurant={restaurant}
      user={user}
      hasKitchenAccess={settingsValue.hasKitchenAccess}
      kitchenStations={settingsValue.kitchenStations}
      securityEvents={settingsValue.securityEvents}
      renderedAt={new Date().toISOString()}
      isOwner={actor.isOwner === true}
      teamMembers={settingsValue.teamMembers}
      teamAuditEvents={settingsValue.teamAuditEvents}
      sectionLoadError={!settings.ok ? settings.error : null}
      billing={billing?.ok ? billing.value : null}
      billingLoadError={billing && !billing.ok ? billing.error : null}
      billingPlanPrices={readBillingPlanPrices()}
      initialSection={initialSection}
      billingCheckoutState={query.checkout === 'success' ? 'success' : null}
      featureAccess={{
        loyalty: loyaltyAccess,
        kitchenDisplay: kitchenDisplayAccess,
        browserNotifications: browserNotificationsAccess,
      }}
      productLocked={!productAccess}
      integrationHealth={[
        ...(integrationHealthResult.ok ? integrationHealthResult.value : []),
        ...(initialSection === 'api' && !integrationHealthResult.ok
          ? [{ provider: 'resend' as const, mode: 'platform' as const, state: 'error' as const, lastCheckedAt: null, lastSuccessAt: null, errorCode: 'health_read_failed' }]
          : []),
      ]}
    />
  )
}
