import { redirect } from 'next/navigation'
import { getDashboardAuthenticatedUser } from '../../../lib/auth/current-user'
import { getRestaurantsForUser } from '../../../lib/queries/restaurants'
import { readOwnerOnboarding } from '../../../lib/actions/onboarding'
import OnboardingFlow from '../../../components/onboarding/OnboardingFlow'

interface Props {
  searchParams: Promise<{ plan?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await getDashboardAuthenticatedUser()
  if (!user) redirect('/auth/login?next=/dashboard/onboarding')

  const [onboarding, restaurants, query] = await Promise.all([
    readOwnerOnboarding(),
    getRestaurantsForUser(),
    searchParams,
  ])
  if ('error' in onboarding) redirect('/auth/login?next=/dashboard/onboarding')

  if (onboarding.snapshot?.status === 'completed' && onboarding.snapshot.restaurantId) {
    redirect(`/dashboard/${onboarding.snapshot.restaurantId}/menu`)
  }
  if (!onboarding.snapshot && restaurants.length > 0) {
    redirect(`/dashboard/${restaurants[0]!.id}/menu`)
  }

  const requestedPlan = query.plan === 'starter' || query.plan === 'plus' || query.plan === 'pro'
    ? query.plan
    : null
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const businessName = typeof metadata?.['business_name'] === 'string' ? metadata['business_name'] : ''
  const adminName = typeof metadata?.['full_name'] === 'string' ? metadata['full_name'] : ''

  return (
    <OnboardingFlow
      initialSnapshot={onboarding.snapshot}
      initialBusinessName={businessName}
      requestedPlan={onboarding.snapshot?.targetPlan ?? requestedPlan}
      adminName={adminName}
      adminEmail={user.email ?? ''}
    />
  )
}
