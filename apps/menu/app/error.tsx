'use client'

import { useEffect } from 'react'
import { RecoveryScreen } from '@garsonless/ui'

export default function MenuError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[menu-route-error]', { publicCode: 'MAS-UI-500', digest: error.digest }, error)
  }, [error])

  return (
    <RecoveryScreen
      kind="error"
      title="Menüyü şu anda açamadık"
      description="Bağlantınızı kontrol edip tekrar deneyin. Sorun sürerse restoran ekibine bildirebilirsiniz."
      code="MAS-UI-500"
      onRetry={reset}
      homeHref="/"
      homeLabel="Ana sayfaya dön"
    />
  )
}
