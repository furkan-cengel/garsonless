'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { MI } from '../lib/icons'

interface SupademoDialogProps {
  eyebrow: string
  title: string
  poster: string
  posterAlt: string
  demoUrl: string | null
  onClose: () => void
}

export function getSupademoEmbedUrl(configured: string | undefined, step?: number) {
  if (!configured) return null

  try {
    const url = new URL(configured)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'app.supademo.com' ||
      !url.pathname.startsWith('/embed/')
    ) {
      return null
    }

    if (step !== undefined) url.searchParams.set('step', String(step))
    return url.toString()
  } catch {
    return null
  }
}

export function SupademoDialog({
  eyebrow,
  title,
  poster,
  posterAlt,
  demoUrl,
  onClose,
}: SupademoDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [frameReady, setFrameReady] = useState(false)
  const [frameFailed, setFrameFailed] = useState(false)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], iframe, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div
      className="product-dialog__backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="product-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supademo-dialog-title"
      >
        <div className="product-dialog__header">
          <div>
            <span>{eyebrow}</span>
            <h3 id="supademo-dialog-title">{title}</h3>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Ürün turunu kapat">
            <MI.x size={20} />
          </button>
        </div>
        <div className="product-dialog__media">
          {!demoUrl && (
            <Image src={poster} alt={posterAlt} fill sizes="(max-width: 760px) 92vw, 980px" />
          )}
          {demoUrl && !frameFailed && (
            <iframe
              title={`${title} etkileşimli ürün turu`}
              src={demoUrl}
              loading="lazy"
              allow="clipboard-write; fullscreen"
              allowFullScreen
              onLoad={() => setFrameReady(true)}
              onError={() => setFrameFailed(true)}
              data-ready={frameReady}
            />
          )}
          {demoUrl && !frameReady && !frameFailed && (
            <div className="product-dialog__loading" role="status">Ürün turu yükleniyor…</div>
          )}
        </div>
        {frameFailed && (
          <p className="product-dialog__error">
            Etkileşimli tur yüklenemedi. Lütfen daha sonra tekrar deneyin.
          </p>
        )}
      </div>
    </div>
  )
}
