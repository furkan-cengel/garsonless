'use client'
import { usePathname } from 'next/navigation'
import { ConsentAnalytics } from '@garsonless/ui/consent-analytics'

export function MarketingAnalytics() {
  return <ConsentAnalytics surface="marketing" pathname={usePathname()} measurementId={process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID} />
}
