import { redirect } from 'next/navigation'
import { getDashboardAuthenticatedUser } from '../../../lib/auth/current-user'
import { getRestaurantsForUser } from '../../../lib/queries/restaurants'
import { readOwnerOnboarding, hasOnboardingLegalEvidence } from '../../../lib/actions/onboarding'
import OnboardingFlow from '../../../components/onboarding/OnboardingFlow'

interface Props {
  searchParams: Promise<{ plan?: string; interval?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const query = await searchParams
  const returnTo = '/dashboard/onboarding?' + new URLSearchParams({ ...(query.plan ? {plan: query.plan} : {}), ...(query.interval ? {interval: query.interval} : {}) }).toString()
  const user = await getDashboardAuthenticatedUser()
  if (!user) redirect('/auth/login?next=' + encodeURIComponent(returnTo))

  const [onboarding, restaurants, hasTerms] = await Promise.all([
    readOwnerOnboarding(),
    getRestaurantsForUser(),
    hasOnboardingLegalEvidence(),
  ])
  if ('error' in onboarding) throw new Error('Kurulum bilgileri yüklenemedi. Lütfen tekrar deneyin.')

  // Keep the authoritative completion screen visible after a Server Action
  // refresh. The regular dashboard entry still lands existing owners in their menu.
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
      requestedInterval={onboarding.snapshot?.targetBillingInterval ?? (query.interval === 'yearly' ? 'yearly' : 'monthly')}
      needsTerms={!hasTerms}
      adminName={adminName}
      adminEmail={user.email ?? ''}
    />
  )
}
