'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { I } from '../../lib/ui'

export default function MenuLoadError({ message }: { message: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#f7f7f8] p-6">
      <section className="w-full max-w-md rounded-2xl border border-[#e4e4e7] bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <I.warn aria-hidden="true" size={21} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[#18181b]">Menü yüklenemedi</h1>
        <p className="mt-2 text-sm leading-6 text-[#71717a]">
          {message} Mevcut menünüzde değişiklik yapılmadı.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#18181b] px-4 text-sm font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181b] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          <I.refresh aria-hidden="true" size={17} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Yeniden deneniyor' : 'Yeniden dene'}
        </button>
      </section>
    </main>
  )
}
