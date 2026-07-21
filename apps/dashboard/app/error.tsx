'use client'

import { useEffect } from 'react'
import { RecoveryScreen } from '@garsonless/ui'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[dashboard-route-error]', { publicCode: 'MAS-UI-500', digest: error.digest }, error)
  }, [error])

  return (
    <RecoveryScreen
      kind="error"
      title="Bir şeyler ters gitti"
      description="Bu ekran şu anda açılamadı. Tekrar deneyebilir veya panoya dönebilirsiniz."
      code="MAS-UI-500"
      onRetry={reset}
      homeHref="/dashboard"
      homeLabel="Panoya dön"
    />
  )
}
