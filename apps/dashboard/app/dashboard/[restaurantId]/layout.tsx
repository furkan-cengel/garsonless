import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import RestaurantShell, { RestaurantShellSkeleton } from '../../../components/layout/RestaurantShell'
import { getRestaurantById, getRestaurantsForUser } from '../../../lib/queries/restaurants'
import { getUserRestaurantAccess } from '../../../lib/auth/access'
import { getDashboardAuthenticatedUser } from '../../../lib/auth/current-user'
import { canRestaurantUseFeatures } from '@garsonless/db/server'
import { getFeatureEntitlement, normalizeRestaurantPlan, PLAN_DEFINITIONS, type BillableFeature } from '@garsonless/domain/entitlements'
import { DASHBOARD_SECTIONS } from '../../../lib/auth/access-policy'
import { DASHBOARD_SECTION_FEATURES, type DashboardSectionEntitlements } from '../../../lib/auth/dashboard-entitlements'
import { createDashboardProfileViewModel } from '../../../lib/profile-view-model'
import { readNotificationPrefs } from '../../../lib/notification-prefs'
import WebVitalsReporter from '../../../components/analytics/WebVitalsReporter'
import { normalizeWebVitalsSampleRate } from '../../../components/analytics/web-vitals-model'
import { readOwnerOnboarding } from '../../../lib/actions/onboarding'

interface Props {
  children: ReactNode
  params: Promise<{ restaurantId: string }>
}

export default async function RestaurantLayout({ children, params }: Props) {
  const { restaurantId } = await params

  const [restaurant, restaurantRows, user, access, onboarding] = await Promise.all([
    getRestaurantById(restaurantId),
    getRestaurantsForUser(),
    getDashboardAuthenticatedUser(),
    getUserRestaurantAccess(restaurantId),
    readOwnerOnboarding(),
  ])

  if (!restaurant || !access) notFound()

  // One round trip for every feature the shell needs instead of one per feature.
  const sectionFeatures = DASHBOARD_SECTIONS
    .map((section) => DASHBOARD_SECTION_FEATURES[section])
    .filter((feature): feature is BillableFeature => Boolean(feature))
  const allowedFeatures = await canRestaurantUseFeatures({
    restaurantId,
    plan: restaurant.plan,
    features: ['browser_notifications', 'table_management', ...sectionFeatures],
  })
  const browserNotificationsEnabled = allowedFeatures.browser_notifications
  const tableOperationsAllowed = allowedFeatures.table_management
  const sectionEntitlementEntries = DASHBOARD_SECTIONS.map((section) => {
    const feature = DASHBOARD_SECTION_FEATURES[section]
    if (!feature) return [section, { allowed: true, feature: null, requiredPlan: null, requiredPlanLabel: null }] as const
    const catalogue = getFeatureEntitlement(restaurant.plan, feature)
    return [section, {
      allowed: allowedFeatures[feature] === true,
      feature,
      requiredPlan: catalogue.requiredPlan,
      requiredPlanLabel: catalogue.requiredPlan ? PLAN_DEFINITIONS[catalogue.requiredPlan].label : null,
    }] as const
  })
  const sectionEntitlements = Object.fromEntries(sectionEntitlementEntries) as DashboardSectionEntitlements

  const restaurants = restaurantRows.map(({ id, name, slug }) => ({ id, name, slug }))
  const notificationPrefs = readNotificationPrefs(restaurant.settings)
  const userEmail = user?.email ?? ''
  const profile = createDashboardProfileViewModel({
    email: userEmail,
    metadata: user?.user_metadata as Record<string, unknown> | undefined,
  })
  const planLabel = PLAN_DEFINITIONS[normalizeRestaurantPlan(restaurant.plan)].label

  return (
    <>
      <WebVitalsReporter sampleRate={normalizeWebVitalsSampleRate(process.env['DASHBOARD_WEB_VITALS_SAMPLE_RATE'])} />
      <RestaurantShell
        restaurantId={restaurantId}
        restaurants={restaurants}
        userEmail={userEmail}
        userDisplayName={profile.displayName}
        userInitials={profile.initials}
        userAvatarUrl={profile.avatarUrl}
        planLabel={planLabel}
        sectionEntitlements={sectionEntitlements}
        tableOperationsAllowed={tableOperationsAllowed}
        permissions={access.permissions}
        isOwner={access.isOwner}
        browserNotificationsEnabled={browserNotificationsEnabled}
        notificationPrefs={notificationPrefs}
        onboardingSnapshot={
          access.isOwner && 'snapshot' in onboarding && onboarding.snapshot?.restaurantId === restaurantId
            ? onboarding.snapshot
            : null
        }
      >
        <Suspense fallback={<RestaurantShellSkeleton />}>
          {children}
        </Suspense>
      </RestaurantShell>
    </>
  )
}
