import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import RestaurantShell, { RestaurantShellSkeleton } from '../../../components/layout/RestaurantShell'
import { getRestaurantById, getRestaurantsForUser } from '../../../lib/queries/restaurants'
import { getUserRestaurantAccess } from '../../../lib/auth/access'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { canRestaurantUseFeature } from '@garsonless/db/server'
import { normalizeRestaurantPlan, PLAN_DEFINITIONS } from '@garsonless/domain/entitlements'
import { createDashboardProfileViewModel } from '../../../lib/profile-view-model'

interface Props {
  children: ReactNode
  params: Promise<{ restaurantId: string }>
}

export default async function RestaurantLayout({ children, params }: Props) {
  const { restaurantId } = await params

  const supabase = await createDashboardServerClient()
  const [restaurant, restaurants, { data: authData }, access] = await Promise.all([
    getRestaurantById(restaurantId),
    getRestaurantsForUser(),
    supabase.auth.getUser(),
    getUserRestaurantAccess(restaurantId),
  ])

  if (!restaurant || !access) notFound()

  const browserNotificationsEnabled = await canRestaurantUseFeature({
    restaurantId,
    plan: restaurant.plan,
    feature: 'browser_notifications',
  })

  const userEmail = authData.user?.email ?? ''
  const profile = createDashboardProfileViewModel({
    email: userEmail,
    metadata: authData.user?.user_metadata as Record<string, unknown> | undefined,
  })
  const planLabel = PLAN_DEFINITIONS[normalizeRestaurantPlan(restaurant.plan)].label

  return (
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
    >
      <Suspense fallback={<RestaurantShellSkeleton />}>
        {children}
      </Suspense>
    </RestaurantShell>
  )
}
