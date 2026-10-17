'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'

/**
 * Interactive GLB preview. model-viewer (three.js inside) is loaded only when
 * a model is on screen, so the menu editor bundle does not carry it.
 */
export function MenuArModelPreview({ src, poster, label }: { src: string; poster: string | null; label: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    let cancelled = false
    let viewer: HTMLElement | null = null
    setState('loading')
    void import('@google/model-viewer')
      .then(() => {
        if (cancelled || !host.current) return
        viewer = document.createElement('model-viewer')
        viewer.setAttribute('src', src)
        if (poster) viewer.setAttribute('poster', poster)
        viewer.setAttribute('alt', label)
        viewer.setAttribute('camera-controls', '')
        viewer.setAttribute('touch-action', 'pan-y')
        viewer.setAttribute('shadow-intensity', '1')
        viewer.setAttribute('interaction-prompt', 'none')
        viewer.style.width = '100%'
        viewer.style.height = '100%'
        viewer.style.background = 'transparent'
        viewer.addEventListener('load', () => { if (!cancelled) setState('ready') })
        viewer.addEventListener('error', () => { if (!cancelled) setState('failed') })
        host.current.replaceChildren(viewer)
      })
      .catch(() => { if (!cancelled) setState('failed') })
    return () => {
      cancelled = true
      viewer?.remove()
    }
  }, [src, poster, label])

  return (
    <div className="relative h-56 overflow-hidden rounded-lg border bg-muted/40">
      <div ref={host} className="size-full" />
      {state !== 'ready' && (
        <div role="status" className="absolute inset-0 grid place-items-center p-4 text-center text-[11.5px] text-muted-foreground">
          {state === 'loading'
            ? <span className="inline-flex items-center gap-2"><Spinner className="size-4" />3D önizleme yükleniyor</span>
            : 'Model önizlemede açılamadı. Dosyayı yeniden dışa aktarıp tekrar yükleyin.'}
        </div>
      )}
    </div>
  )
}
