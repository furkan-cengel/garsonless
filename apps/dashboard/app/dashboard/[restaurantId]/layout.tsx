import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import RestaurantShell, { RestaurantShellSkeleton } from '../../../components/layout/RestaurantShell'
import NavigationProgress from '../../../components/layout/NavigationProgress'
import NavigationPendingOverlay from '../../../components/layout/NavigationPendingOverlay'
import { getRestaurantById, getRestaurantsForUser } from '../../../lib/queries/restaurants'
import { getUserRestaurantAccess } from '../../../lib/auth/access'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { canUseFeature } from '@garsonless/domain/entitlements'

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

  const userEmail = authData.user?.email ?? ''
  const local = userEmail.split('@')[0] ?? ''
  const parts = local.split(/[._-]/)
  const userInitials =
    parts.length >= 2
      ? ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
      : local.slice(0, 2).toUpperCase()

  return (
    <RestaurantShell
      restaurantId={restaurantId}
      restaurants={restaurants}
      userEmail={userEmail}
      userInitials={userInitials || 'U'}
      permissions={access.permissions}
      isOwner={access.isOwner}
      browserNotificationsEnabled={canUseFeature(restaurant.plan, 'browser_notifications')}
    >
      <NavigationProgress />
      <NavigationPendingOverlay />
      <Suspense fallback={<RestaurantShellSkeleton />}>
        {children}
      </Suspense>
    </RestaurantShell>
  )
}
