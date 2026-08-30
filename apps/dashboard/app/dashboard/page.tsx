import { redirect } from 'next/navigation'
import { getRestaurantsForUser } from '../../lib/queries/restaurants'
import { getUserRestaurantAccess, firstPermittedPath } from '../../lib/auth/access'
import { canRestaurantUseFeature } from '@garsonless/db/server'

export default async function DashboardIndexPage() {
  const restaurants = await getRestaurantsForUser()
  // A valid account without restaurant access is an unfinished activation,
  // regardless of whether it arrived from signup, a confirmed demo account,
  // or a resumed browser session. Login remains directly reachable as the
  // account-switch escape hatch; the dashboard entry itself resumes setup.
  if (restaurants.length === 0) redirect('/dashboard/onboarding')

  // Land on the first restaurant's first PERMITTED section (owner → Pano; a
  // member without 'pano' → their first section in nav order). Never notFound.
  const first = restaurants[0]!
  const access = await getUserRestaurantAccess(first.id)
  if (access && (access.isOwner || access.permissions.includes('menu'))) {
    const panoAllowed = await canRestaurantUseFeature({
      restaurantId: first.id,
      plan: first.plan,
      feature: 'analytics_basic',
    })
    if (!panoAllowed) redirect(`/dashboard/${first.id}/menu`)
  }
  redirect(access ? firstPermittedPath(first.id, access) : `/dashboard/${first.id}`)
}
