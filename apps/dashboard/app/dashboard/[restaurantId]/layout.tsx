import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import RestaurantShell, { RestaurantShellSkeleton } from '../../../components/layout/RestaurantShell'
import { getRestaurantById, getRestaurantsForUser } from '../../../lib/queries/restaurants'
import { getUserRestaurantAccess } from '../../../lib/auth/access'
import { getDashboardAuthenticatedUser } from '../../../lib/auth/current-user'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import { normalizeRestaurantPlan, PLAN_DEFINITIONS } from '@garsonless/domain/entitlements'
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

  const browserNotificationsEnabled = await canRestaurantUseFeature({
    restaurantId,
    plan: restaurant.plan,
    feature: 'browser_notifications',
  })

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
