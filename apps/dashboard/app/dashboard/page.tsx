import { redirect } from 'next/navigation'
import { getRestaurantsForUser } from '../../lib/queries'

export default async function DashboardIndexPage() {
  const restaurants = await getRestaurantsForUser()
  if (restaurants.length > 0) {
    redirect(`/dashboard/${restaurants[0]!.id}/menu`)
  }
  redirect('/dashboard/onboarding')
}
