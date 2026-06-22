import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import RestaurantShell, { RestaurantShellSkeleton } from '../../../components/layout/RestaurantShell'
import NavigationProgress from '../../../components/layout/NavigationProgress'
import { getRestaurantById, getRestaurantsForUser } from '../../../lib/queries'
import { createDashboardServerClient } from '../../../lib/supabase-server'

interface Props {
  children: ReactNode
  params: Promise<{ restaurantId: string }>
}

export default async function RestaurantLayout({ children, params }: Props) {
  const { restaurantId } = await params

  const supabase = await createDashboardServerClient()
  const [restaurant, restaurants, { data: authData }] = await Promise.all([
    getRestaurantById(restaurantId),
    getRestaurantsForUser(),
    supabase.auth.getUser(),
  ])

  if (!restaurant) notFound()

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
    >
      <NavigationProgress />
      <Suspense fallback={<RestaurantShellSkeleton />}>
        {children}
      </Suspense>
    </RestaurantShell>
  )
}
