'use client'

import { RecoveryScreen } from '@garsonless/ui/errors'
import { useEffect } from 'react'

export default function MarketingGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[marketing-global-error]', { publicCode: 'MAS-UI-500', digest: error.digest }, error)
  }, [error])

  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>
        <RecoveryScreen
          kind="error"
          title="Masabu şu anda açılamıyor"
          description="Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin."
          code="MAS-UI-500"
          onRetry={reset}
          homeHref="/"
          homeLabel="Ana sayfaya dön"
          statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
        />
      </body>
    </html>
  )
}
