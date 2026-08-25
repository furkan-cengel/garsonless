'use client'

import { RecoveryScreen } from '@garsonless/ui/errors'
import { useEffect } from 'react'

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[marketing-route-error]', { publicCode: 'MAS-UI-500', digest: error.digest }, error)
  }, [error])

  return (
    <RecoveryScreen
      kind="error"
      title="Sayfayı şu anda açamadık"
      description="Kısa süre sonra tekrar deneyebilir veya ana sayfaya dönebilirsiniz."
      code="MAS-UI-500"
      onRetry={reset}
      homeHref="/"
      homeLabel="Ana sayfaya dön"
      statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
    />
  )
}
