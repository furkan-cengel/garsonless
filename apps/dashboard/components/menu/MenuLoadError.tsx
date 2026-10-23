'use client'

import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { I } from '../../lib/ui'
import PageTopBar from '../layout/PageTopBar'

/**
 * Menu could not be read. The page chrome stays so the owner knows where they
 * are, but no menu data or counts are shown: a half-loaded menu would read as
 * products having vanished.
 */
export default function MenuLoadError({ restaurantName, message, code, occurredAt }: {
  restaurantName: string
  message: string
  code: 'forbidden' | 'unavailable'
  occurredAt: string
}) {
  const router = useRouter()
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const [isPending, startTransition] = useTransition()
  const time = new Date(occurredAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="menu-manager" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageTopBar restaurantName={restaurantName} title="Menü" />
      <main className="menu-state-center" style={{ flex: 1, background: 'var(--bg)' }}>
        <Empty className="menu-state-box">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-[var(--warning-bg)] text-[var(--warning)]">
              <I.warn aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{code === 'forbidden' ? 'Bu menüye erişimin yok' : 'Menü yüklenemedi'}</EmptyTitle>
            <EmptyDescription>
              {code === 'forbidden'
                ? `${message} İşletme sahibinden menü yetkisi isteyebilirsin.`
                : `${message} Hiçbir şey değiştirilmedi, menü verilerin güvende.`}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-2">
              {code === 'unavailable' && (
                <Button type="button" aria-busy={isPending} disabled={isPending} onClick={() => startTransition(() => router.refresh())}>
                  {isPending ? <Spinner aria-hidden="true" data-icon="inline-start" /> : <I.refresh data-icon="inline-start" aria-hidden="true" />}
                  {isPending ? 'Yeniden deneniyor' : 'Tekrar dene'}
                </Button>
              )}
              <Button nativeButton={false} variant="outline" render={<Link href={`/dashboard/${restaurantId}`} />}>Panoya dön</Button>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">{code === 'forbidden' ? 'erişim yok' : 'menü okunamadı'} · {time}</p>
          </EmptyContent>
        </Empty>
      </main>
    </div>
  )
}
