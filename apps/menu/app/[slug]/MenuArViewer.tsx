'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AppIcons as I } from '@garsonless/ui/icons'
import { useMenuLocale } from '@garsonless/ui/menu/MenuLocaleContext'
import type { MenuItem } from '@garsonless/ui/menu'
import { formatMenuArSize } from '../../lib/menu-ar'
import { menuArSupport, type MenuArSupport } from '../../lib/menu-ar-support'

type ModelViewerElement = HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> }

// model-viewer picks its AR mode asynchronously (Android first asks the
// browser about WebXR), so support is read again for a few seconds.
const AR_RECHECK_MS = [0, 600, 1500, 3000, 6000]

/**
 * Full-screen 3D view of a published model, opened from the product modal.
 * The modal stays mounted underneath, so the guest's selections survive a
 * trip into the native AR viewer and back.
 */
export function MenuArViewer({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { t, locale } = useMenuLocale()
  const titleId = useId()
  const host = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<ModelViewerElement | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [support, setSupport] = useState<MenuArSupport>('checking')
  const ar = item.ar!

  useEffect(() => {
    closeRef.current?.focus()
    // Captured before the product modal's own Escape and focus-trap handlers,
    // so keys act on the viewer only while it is open.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      event.stopImmediatePropagation()
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), model-viewer')]
      if (focusable.length === 0) return
      const index = focusable.indexOf(document.activeElement as HTMLElement)
      const next = focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]
      event.preventDefault()
      next?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []
    let viewer: ModelViewerElement | null = null
    void import('@google/model-viewer')
      .then(() => {
        if (cancelled || !host.current) return
        viewer = document.createElement('model-viewer') as ModelViewerElement
        viewer.setAttribute('src', ar.glbUrl)
        if (ar.usdzUrl) viewer.setAttribute('ios-src', ar.usdzUrl)
        if (ar.posterUrl) viewer.setAttribute('poster', ar.posterUrl)
        viewer.setAttribute('alt', item.name)
        viewer.setAttribute('ar', '')
        viewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
        viewer.setAttribute('ar-scale', 'fixed')
        viewer.setAttribute('ar-placement', 'floor')
        viewer.setAttribute('camera-controls', '')
        viewer.setAttribute('touch-action', 'pan-y')
        viewer.setAttribute('shadow-intensity', '1')
        viewer.setAttribute('interaction-prompt', 'none')
        viewer.style.width = '100%'
        viewer.style.height = '100%'
        viewer.style.background = 'transparent'
        // Our own button starts AR; hide model-viewer's default one.
        const slot = document.createElement('span')
        slot.setAttribute('slot', 'ar-button')
        slot.hidden = true
        viewer.appendChild(slot)
        viewer.addEventListener('load', () => { if (!cancelled) setState('ready') })
        viewer.addEventListener('error', () => { if (!cancelled) setState('failed') })
        host.current.replaceChildren(viewer)
        viewerRef.current = viewer
        AR_RECHECK_MS.forEach((delay, index) => {
          const final = index === AR_RECHECK_MS.length - 1
          timers.push(window.setTimeout(() => {
            if (cancelled || !viewer) return
            void menuArSupport(viewer.canActivateAR === true).then((next) => {
              // An early "unsupported" may only mean model-viewer has not decided yet.
              if (!cancelled && (next !== 'unsupported' || final)) setSupport(next)
            })
          }, delay))
        })
      })
      .catch(() => { if (!cancelled) setState('failed') })
    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
      viewer?.remove()
      viewerRef.current = null
    }
  }, [ar.glbUrl, ar.usdzUrl, ar.posterUrl, item.name])

  const size = formatMenuArSize(ar, locale === 'en' ? 'en' : 'tr')

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-component="menu-ar-viewer"
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', background: 'var(--p-bg, #fff)', color: 'var(--p-text)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 8px 18px' }}>
        <h2 id={titleId} style={{ margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--p-display)', fontSize: 18, fontWeight: 800 }}>
          {item.name}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t('Kapat')}
          style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', border: 0, borderRadius: 999, background: 'var(--p-accent-soft)', color: 'var(--p-text)', cursor: 'pointer' }}
        >
          <I.close size={19} />
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={host} style={{ width: '100%', height: '100%' }} />
        {state !== 'ready' && (
          <div role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: 'var(--p-text-2)', fontSize: 14 }}>
            {state === 'loading' ? t('3D model yükleniyor…') : (
              <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
                <span>{t('3D model şu an açılamadı.')}</span>
                <button type="button" onClick={onClose} style={secondaryButton}>{t('Ürün fotoğrafına dön')}</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10, padding: '12px 18px calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--p-border)' }}>
        <div style={{ display: 'grid', gap: 3, fontSize: 13, lineHeight: 1.45, color: 'var(--p-text-2)' }}>
          {(size || ar.portionNote) && (
            <span style={{ color: 'var(--p-text)', fontWeight: 700 }}>
              {[size, ar.portionNote].filter(Boolean).join(' · ')}
            </span>
          )}
          <span>{t('Standart sunum gösteriliyor; seçtiğiniz ekstralar modelde görünmez.')}</span>
          {state === 'ready' && <span>{t('Döndürmek için sürükleyin, yakınlaştırmak için iki parmakla açın.')}</span>}
        </div>
        {state === 'ready' && support === 'available' && (
          <button
            type="button"
            data-component="menu-ar-activate"
            onClick={() => { void viewerRef.current?.activateAR?.() }}
            style={{ minHeight: 48, border: 0, borderRadius: 999, background: 'var(--p-accent)', color: 'var(--p-on-accent, #fff)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
          >
            {t('Masamda gör')}
          </button>
        )}
        {state === 'ready' && support === 'desktop' && (
          <span style={{ fontSize: 12.5, color: 'var(--p-text-2)' }}>{t('Ürünü masanızda görmek için menüyü telefonunuzda açın.')}</span>
        )}
        {state === 'ready' && support === 'unsupported' && (
          <span style={{ fontSize: 12.5, color: 'var(--p-text-2)' }}>{t('Bu cihaz masada görüntülemeyi desteklemiyor; 3D incelemeye devam edebilirsiniz.')}</span>
        )}
      </div>
    </div>
  )
}

const secondaryButton = {
  minHeight: 40,
  padding: '0 16px',
  border: '1px solid var(--p-border)',
  borderRadius: 999,
  background: 'var(--p-card)',
  color: 'var(--p-text)',
  fontWeight: 700,
  cursor: 'pointer',
} as const
