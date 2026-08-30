import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import RestaurantShell, { RestaurantShellSkeleton } from '../../../components/layout/RestaurantShell'
import { getRestaurantById, getRestaurantsForUser } from '../../../lib/queries/restaurants'
import { getUserRestaurantAccess } from '../../../lib/auth/access'
import { getDashboardAuthenticatedUser } from '../../../lib/auth/current-user'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import { getFeatureEntitlement, normalizeRestaurantPlan, PLAN_DEFINITIONS } from '@garsonless/domain/entitlements'
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

  const [browserNotificationsEnabled, tableOperationsAllowed, sectionEntitlementEntries] = await Promise.all([
    canRestaurantUseFeature({
      restaurantId,
      plan: restaurant.plan,
      feature: 'browser_notifications',
    }),
    canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature: 'table_management' }),
    Promise.all(DASHBOARD_SECTIONS.map(async (section) => {
      const feature = DASHBOARD_SECTION_FEATURES[section]
      if (!feature) return [section, { allowed: true, feature: null, requiredPlan: null, requiredPlanLabel: null }] as const
      const [allowed, catalogue] = await Promise.all([
        canRestaurantUseFeature({ restaurantId, plan: restaurant.plan, feature }),
        Promise.resolve(getFeatureEntitlement(restaurant.plan, feature)),
      ])
      return [section, {
        allowed,
        feature,
        requiredPlan: catalogue.requiredPlan,
        requiredPlanLabel: catalogue.requiredPlan ? PLAN_DEFINITIONS[catalogue.requiredPlan].label : null,
      }] as const
    })),
  ])
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
