import type { OnboardingSnapshot } from '@garsonless/application/onboarding'
import {
  ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VERSION,
  type MarketingAnalyticsEvent,
} from '@garsonless/domain/marketing-analytics'

type MenuResult = { error: string } | { replayed: boolean; snapshot: OnboardingSnapshot }

/** Only successful mutations count, never rendering or resuming the completion screen. */
export function menuSetupEvents(result: MenuResult, previousItemCount: number): MarketingAnalyticsEvent[] {
  if ('error' in result || result.replayed) return []
  const { snapshot } = result
  if (snapshot.status !== 'completed' || !snapshot.completedSteps.includes('menu')
    || snapshot.itemCount < 1 || !snapshot.menuEntryMethod) return []
  const events: MarketingAnalyticsEvent[] = []
  if (previousItemCount === 0) events.push({ name: 'first_product_added', method: snapshot.menuEntryMethod })
  events.push({ name: 'menu_setup_completed', method: snapshot.menuEntryMethod })
  return events
}

export async function trackOnboardingEvent(event: MarketingAnalyticsEvent): Promise<void> {
  if (!process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || typeof document === 'undefined'
    || !document.cookie.split('; ').includes(`${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VERSION}:granted`)) return
  // Keep optional measurement out of the ready bundle. The sender checks consent again.
  // No queue: events that occur without consent are never replayed later.
  try {
    const { trackMarketingEvent } = await import('@garsonless/ui/analytics-client')
    trackMarketingEvent(event)
  } catch { /* Measurement cannot block onboarding or navigation. */ }
}
