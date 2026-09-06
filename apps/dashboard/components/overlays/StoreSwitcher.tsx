'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { I, S } from '../../lib/ui'
import { useModalDialogFocus } from './use-modal-dialog-focus'
import { useShell } from '../../lib/shell-context'
import type { RestaurantSwitcherItem } from '../layout/restaurant-shell-model'

const GRADIENTS = [
  'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
  'linear-gradient(135deg, #a4f7c8 0%, #4caf7f 100%)',
  'linear-gradient(135deg, #c4d0ff 0%, #6e87e5 100%)',
  'linear-gradient(135deg, #f5dcea 0%, #d97757 100%)',
  'linear-gradient(135deg, #fde7c2 0%, #f0a46c 100%)',
  'linear-gradient(135deg, #dce6f0 0%, #8baed4 100%)',
]

const STORE_SWITCHER_CSS = `
.store-switcher-overlay { position:fixed;inset:0;z-index:110; }
.store-switcher-dialog {
  position:absolute;left:68px;top:32px;width:min(340px,calc(100vw - 84px));max-height:calc(100dvh - 64px);
  display:flex;flex-direction:column;overflow:hidden;background:var(--surface);border:1px solid var(--border);
  border-radius:12px;box-shadow:var(--shadow-pop);outline:0;
}
.store-switcher-row { min-height:44px; }
.store-switcher-row:hover:not(:disabled) { background:var(--surface-3)!important; }
.store-switcher-row:focus-visible,.store-switcher-close:focus-visible { outline:2px solid var(--action);outline-offset:-2px; }
@media (max-width:760px) {
  .store-switcher-overlay { display:flex;align-items:flex-end;background:rgba(17,17,19,.32);backdrop-filter:blur(2px); }
  .store-switcher-dialog { position:relative;left:auto;top:auto;width:100%;max-height:min(86dvh,720px);padding-bottom:env(safe-area-inset-bottom);border-radius:16px 16px 0 0; }
}
`

interface Props {
  restaurants: RestaurantSwitcherItem[]
  currentRestaurantId: string
  isOwner: boolean
  onClose: () => void
}

export default function StoreSwitcher({ restaurants, currentRestaurantId, isOwner, onClose }: Props) {
  const { beginNavigation, interceptNavigation } = useShell()
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const attemptedRef = useRef(false)
  const router = useRouter()
  const dialogRef = useModalDialogFocus(onClose)
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
  const filtered = normalizedQuery
    ? restaurants.filter((restaurant) => `${restaurant.name} ${restaurant.slug}`.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
    : restaurants

  useEffect(() => {
    if (!pendingId) return
    if (currentRestaurantId === pendingId) {
      setPendingId(null)
      setError('')
      onClose()
      return
    }
    if (attemptedRef.current && !pending) {
      attemptedRef.current = false
      setError('Mağaza açılamadı. Bağlantını kontrol edip tekrar dene.')
    }
  }, [currentRestaurantId, onClose, pending, pendingId])

  function handleSelect(id: string, confirmed = false) {
    if (!confirmed && id !== currentRestaurantId && interceptNavigation?.(() => handleSelect(id, true))) return
    if (id === currentRestaurantId) {
      onClose()
      return
    }
    setError('')
    setPendingId(id)
    attemptedRef.current = true
    startTransition(() => {
      const href = `/dashboard/${id}`
      beginNavigation(href)
      router.push(href)
    })
  }

  return (
    <div className="store-switcher-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
      <style>{STORE_SWITCHER_CSS}</style>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="store-switcher-title" aria-busy={pending} className="store-switcher-dialog" tabIndex={-1}>
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div id="store-switcher-title" style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Tüm mağazalar</div>
            <button type="button" aria-label="Mağaza seçiciyi kapat" className="store-switcher-close" onClick={onClose} disabled={pending} style={{ width: 44, height: 44, margin: -10, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}><I.x size={16} /></button>
          </div>
          <label style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderRadius: 7, background: 'var(--surface-3)', color: 'var(--text-3)' }}>
            <I.search size={14} />
            <input data-dialog-initial-focus aria-label="Mağaza ara" placeholder="Mağaza ara" value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text)', fontSize: 12.5 }} />
          </label>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '6px' }}>
          <div style={{ ...S.label, padding: '6px 10px 4px' }}>{filtered.length} mağaza</div>
          {filtered.map((restaurant, index) => {
            const active = restaurant.id === currentRestaurantId
            const rowPending = restaurant.id === pendingId && pending
            return (
              <button
                key={restaurant.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                disabled={pending}
                className="store-switcher-row"
                onClick={() => handleSelect(restaurant.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 10px', borderRadius: 7, background: active ? 'var(--surface-inset)' : 'transparent', border: 0, cursor: pending ? 'wait' : 'pointer', textAlign: 'left', color: 'var(--text)' }}
              >
                <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: GRADIENTS[index % GRADIENTS.length], color: '#fff', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{restaurant.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: active ? 650 : 500 }}>{restaurant.name}</span>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5, color: 'var(--text-3)' }}>{restaurant.slug}</span>
                </span>
                {rowPending ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Açılıyor…</span> : active ? <span aria-hidden="true" style={{ color: 'var(--positive)', display: 'inline-flex' }}><I.check size={14} /></span> : null}
              </button>
            )
          })}
          {filtered.length === 0 && <div role="status" style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Sonuç bulunamadı.</div>}
          {error && (
            <div role="alert" style={{ margin: 6, padding: '8px 10px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
              {error}
              {pendingId && <button type="button" onClick={() => handleSelect(pendingId)} style={{ display: 'block', minHeight: 36, padding: 0, border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Tekrar dene</button>}
            </div>
          )}
        </div>

        {isOwner && <div style={{ padding: '6px', borderTop: '1px solid var(--divider)' }}>
          <button
            type="button"
            disabled={pending}
            className="store-switcher-row"
            onClick={() => {
              const href = `/dashboard/${currentRestaurantId}/settings?section=workspace`
              const navigate = () => { beginNavigation(href); router.push(href); onClose() }
              if (!interceptNavigation?.(navigate)) navigate()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 10px', borderRadius: 7, border: 0, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', textAlign: 'left' }}
          >
            <span aria-hidden="true" style={{ width: 32, display: 'inline-flex', justifyContent: 'center' }}><I.gear size={15} /></span>
            <span style={{ fontSize: 12.5, fontWeight: 550 }}>Mağazaları yönet</span>
          </button>
        </div>}
      </div>
    </div>
  )
}
