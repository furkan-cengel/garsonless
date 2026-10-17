'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const GLB = '/ar-spike/test-plate.glb'
const USDZ = '/ar-spike/test-plate.usdz'
const DRAFT_KEY = 'masabu:ar-spike:draft'

type Draft = { quantity: number; extraCream: boolean; cart: number }
type ViewerState = 'idle' | 'loading' | 'ready' | 'error'
type ModelViewerElement = HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> }

const initialDraft: Draft = { quantity: 1, extraCream: false, cart: 0 }

function readDraft(): Draft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    const parsed = raw ? JSON.parse(raw) as Partial<Draft> : null
    if (!parsed) return initialDraft
    return {
      quantity: Math.min(9, Math.max(1, Number(parsed.quantity) || 1)),
      extraCream: parsed.extraCream === true,
      cart: Math.max(0, Number(parsed.cart) || 0),
    }
  } catch {
    return initialDraft
  }
}

function platformLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iOS (Quick Look)'
  if (/Android/.test(ua)) return 'Android (WebXR / Scene Viewer)'
  return 'Masaüstü (yalnız 3D)'
}

/**
 * Spike flow: product → "3D incele" (viewer loads on demand) → "Masamda gör"
 * (native AR) → back to the product with the selection intact → add to cart.
 * The event log is for device testing; nothing here touches real menu data.
 */
export default function ArSpikeClient() {
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [viewer, setViewer] = useState<ViewerState>('idle')
  const [canAR, setCanAR] = useState<boolean | null>(null)
  const [log, setLog] = useState<string[]>([])
  const host = useRef<HTMLDivElement>(null)
  const element = useRef<ModelViewerElement | null>(null)

  const note = useCallback((line: string) => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLog((current) => [`${time} · ${line}`, ...current].slice(0, 40))
  }, [])

  // Restore the unsent selection (the AR round trip may reload the page on some devices).
  useEffect(() => {
    const saved = readDraft()
    setDraft(saved)
    note(`Sayfa açıldı · ${platformLabel()} · seçim: ${saved.quantity} adet${saved.extraCream ? ' + krema' : ''}, sepette ${saved.cart}`)
    const onVisibility = () => { if (document.visibilityState === 'visible') note('Sayfaya geri dönüldü') }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [note])

  // Persist on user action only: an effect could overwrite the stored draft
  // before it is read back (React runs mount effects twice in development).
  const updateDraft = useCallback((change: (current: Draft) => Draft) => {
    setDraft((current) => {
      const next = change(current)
      try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch { /* private mode: keep in memory */ }
      return next
    })
  }, [])

  const openViewer = useCallback(async () => {
    if (!host.current) return
    setViewer('loading')
    note('3D incele: görüntüleyici indiriliyor')
    try {
      await import('@google/model-viewer')
    } catch {
      setViewer('error')
      note('Görüntüleyici yüklenemedi')
      return
    }
    host.current.replaceChildren()
    const mv = document.createElement('model-viewer') as ModelViewerElement
    mv.setAttribute('src', GLB)
    mv.setAttribute('ios-src', USDZ)
    mv.setAttribute('alt', 'Test tatlısı, 26 cm tabakta')
    mv.setAttribute('ar', '')
    mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
    mv.setAttribute('ar-scale', 'fixed')
    mv.setAttribute('ar-placement', 'floor')
    mv.setAttribute('camera-controls', '')
    mv.setAttribute('touch-action', 'pan-y')
    mv.setAttribute('shadow-intensity', '1')
    mv.style.width = '100%'
    mv.style.height = '320px'
    mv.style.background = '#f4f1ea'
    mv.style.borderRadius = '12px'
    // Hide the built-in AR button; the page offers its own "Masamda gör".
    const slot = document.createElement('span')
    slot.setAttribute('slot', 'ar-button')
    slot.style.display = 'none'
    mv.appendChild(slot)
    mv.addEventListener('load', () => {
      setViewer('ready')
      setCanAR(Boolean(mv.canActivateAR))
      note(`Model yüklendi · AR ${mv.canActivateAR ? 'kullanılabilir' : 'bu cihazda kullanılamıyor'}`)
    })
    mv.addEventListener('error', () => { setViewer('error'); note('Model yüklenemedi') })
    mv.addEventListener('ar-status', (event) => {
      const status = (event as CustomEvent<{ status: string }>).detail?.status
      note(`AR durumu: ${status}`)
    })
    host.current.appendChild(mv)
    element.current = mv
  }, [note])

  const startAR = useCallback(async () => {
    const mv = element.current
    if (!mv?.activateAR) return
    note('Masamda gör: AR başlatılıyor')
    try {
      await mv.activateAR()
    } catch {
      note('AR başlatılamadı')
    }
  }, [note])

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif', color: '#1c1b19' }}>
      <p style={{ fontSize: 12, color: '#7a756c', margin: '0 0 8px' }}>Masabu · 3D / AR teknik deneme (test modeli, gerçek menü değil)</p>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Test Tatlısı</h1>
      <p style={{ margin: '0 0 12px', color: '#4a463f' }}>Standart porsiyon · 26 cm tabak · ₺180</p>

      {viewer === 'idle' && (
        <div style={{ height: 180, borderRadius: 12, background: '#f4f1ea', display: 'grid', placeItems: 'center', color: '#7a756c' }}>Ürün fotoğrafı</div>
      )}
      {/* The viewer element is created imperatively; React never renders children here. */}
      <div ref={host} aria-live="polite" />
      {viewer === 'loading' && <p role="status">3D model hazırlanıyor…</p>}
      {viewer === 'error' && (
        <div role="alert" style={{ margin: '8px 0', padding: 12, borderRadius: 10, background: '#fdecea' }}>
          3D görünüm açılamadı. Fotoğrafla siparişe devam edebilirsin.
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => void openViewer()}>Tekrar dene</button>
            <button type="button" onClick={() => { host.current?.replaceChildren(); element.current = null; setViewer('idle') }}>Fotoğrafa dön</button>
          </div>
        </div>
      )}
      {viewer === 'ready' && <p style={{ fontSize: 12, color: '#7a756c' }}>Standart sunum gösteriliyor; seçtiğin ekstralar modele yansımaz.</p>}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {viewer === 'idle' && <button type="button" onClick={() => void openViewer()} style={buttonStyle}>3D incele</button>}
        {viewer === 'ready' && (
          <button type="button" onClick={() => void startAR()} disabled={!canAR} style={{ ...buttonStyle, opacity: canAR ? 1 : 0.45 }}>
            Masamda gör
          </button>
        )}
        {viewer === 'ready' && !canAR && (
          <span style={{ alignSelf: 'center', fontSize: 12, color: '#7a756c' }}>Bu cihaz veya tarayıcı AR desteklemiyor; 3D inceleme açık.</span>
        )}
      </div>

      <fieldset style={{ border: '1px solid #e5e0d6', borderRadius: 10, padding: 12, margin: '12px 0' }}>
        <legend>Seçimin (AR dönüşünde korunmalı)</legend>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          Adet
          <input type="number" min={1} max={9} value={draft.quantity} onChange={(event) => updateDraft((d) => ({ ...d, quantity: Math.min(9, Math.max(1, Number(event.target.value) || 1)) }))} style={{ width: 56 }} />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input type="checkbox" checked={draft.extraCream} onChange={(event) => updateDraft((d) => ({ ...d, extraCream: event.target.checked }))} />
          Ekstra krema (+₺20)
        </label>
      </fieldset>

      <button type="button" style={{ ...buttonStyle, width: '100%' }} onClick={() => { updateDraft((d) => ({ ...d, cart: d.cart + d.quantity })); note(`Sepete eklendi: ${draft.quantity} adet${draft.extraCream ? ' + krema' : ''}`) }}>
        Sepete ekle · sepette {draft.cart}
      </button>

      <section aria-label="Olay günlüğü" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 14 }}>Olay günlüğü (test için)</h2>
        <ol style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', paddingLeft: 18, color: '#4a463f' }}>
          {log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
        </ol>
        <button type="button" onClick={() => { updateDraft(() => initialDraft); setLog([]) }}>Denemeyi sıfırla</button>
      </section>
    </main>
  )
}

const buttonStyle: CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: 0,
  background: '#1c1b19',
  color: '#fff',
  fontWeight: 600,
  fontSize: 15,
}
