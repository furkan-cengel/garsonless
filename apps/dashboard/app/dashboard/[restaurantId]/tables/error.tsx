'use client'

import { useEffect, useMemo, startTransition } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { RecoveryScreen } from '@garsonless/ui/errors'
import { routeErrorDetails } from '../../../../components/errors/route-error-details'
import { reportClientError } from '../../../../components/errors/report-client-error'

/* Tables and QR Studio say which screen failed and that tables, QR codes and the saved style are untouched. */
export default function TablesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ restaurantId: string }>()
  const isQR = pathname?.endsWith('/tables/qr') ?? false
  const details = useMemo(() => routeErrorDetails(error, pathname), [error, pathname])

  useEffect(() => {
    console.error('[tables-route-error]', { publicCode: 'MAS-UI-500', digest: error.digest, screen: isQR ? 'qr' : 'operations' }, error)
    reportClientError(error, isQR ? 'tables-qr' : 'tables', pathname)
  }, [error, isQR, pathname])

  return (
    <RecoveryScreen
      kind="error"
      title={isQR ? 'QR Studio bir hatayla karşılaştı' : 'Masalar ekranı bir hatayla karşılaştı'}
      description={isQR
        ? 'Masaların, QR kodların ve kayıtlı QR stilin etkilenmedi. Tekrar denediğinde QR Studio yeniden açılır.'
        : 'Masaların, açık adisyonların ve ödemeler etkilenmedi. Tekrar denediğinde ekran güncel durumla yeniden açılır.'}
      code="MAS-UI-500"
      onRetry={() => startTransition(() => { router.refresh(); reset() })}
      homeHref={params?.restaurantId ? `/dashboard/${params.restaurantId}` : '/dashboard'}
      homeLabel="Panoya dön"
      details={details}
    />
  )
}
