'use client'

import { useRouter } from 'next/navigation'
import { startTransition } from 'react'
import { RecoveryScreen } from '@garsonless/ui/errors'

export default function ThemeError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return <RecoveryScreen
    kind="error"
    code="MAS-THEME-LOAD"
    title="Tema verileri yüklenemedi"
    description="Düzenleyiciyi açmak için tema ve menü verilerinin yüklenmesi gerekiyor. Kayıtlı taslağınız değiştirilmedi. Lütfen tekrar deneyin."
    onRetry={() => startTransition(() => { router.refresh(); reset() })}
    homeHref="/dashboard"
    homeLabel="Panoya dön"
  />
}
