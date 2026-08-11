'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { I } from '../../lib/ui'

export default function MenuLoadError({ message }: { message: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#f7f7f8] p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="justify-items-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--warning-bg)] text-[var(--warning)]">
            <I.warn aria-hidden="true" size={21} />
          </span>
          <CardTitle className="mt-2 text-lg">Menü yüklenemedi</CardTitle>
          <CardDescription className="leading-6">{message} Mevcut menünüzde değişiklik yapılmadı.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" size="lg" disabled={isPending} onClick={() => startTransition(() => router.refresh())}>
            {isPending ? <Spinner data-icon="inline-start" /> : <I.refresh data-icon="inline-start" aria-hidden="true" size={17} />}
            {isPending ? 'Yeniden deneniyor' : 'Yeniden dene'}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
