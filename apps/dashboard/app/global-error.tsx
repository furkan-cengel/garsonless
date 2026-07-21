'use client'

import { useEffect } from 'react'
import { RecoveryScreen } from '@garsonless/ui'

export default function DashboardGlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[dashboard-global-error]', { publicCode: 'MAS-UI-500', digest: error.digest }, error)
  }, [error])

  return (
    <html lang="tr">
      <body>
        <RecoveryScreen
          kind="error"
          title="Uygulama başlatılamadı"
          description="Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin."
          code="MAS-UI-500"
          onRetry={reset}
          homeHref="/dashboard"
          homeLabel="Panoya dön"
        />
      </body>
    </html>
  )
}
