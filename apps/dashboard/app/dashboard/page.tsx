import { redirect } from 'next/navigation'
import { getRestaurantsForUser } from '../../lib/queries/restaurants'
import { getUserRestaurantAccess, firstPermittedPath } from '../../lib/auth/access'

export default async function DashboardIndexPage() {
  const restaurants = await getRestaurantsForUser()
  // An authenticated browser may still be carrying a session for a newly
  // created or otherwise unprovisioned user. Do not trap that browser in
  // onboarding: existing users must be able to replace the session from the
  // login screen. New-account creation reaches onboarding explicitly.
  if (restaurants.length === 0) redirect('/auth/login?next=/dashboard')

  // Land on the first restaurant's first PERMITTED section (owner → Pano; a
  // member without 'pano' → their first section in nav order). Never notFound.
  const first = restaurants[0]!
  const access = await getUserRestaurantAccess(first.id)
  redirect(access ? firstPermittedPath(first.id, access) : `/dashboard/${first.id}`)
}
