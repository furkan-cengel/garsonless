'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ThemeEditorSurface } from '@garsonless/design-engine'
import { I, type Icon } from '../../lib/ui'

const SURFACES: Array<{ id: ThemeEditorSurface; label: string; description: string; icon: Icon }> = [
  { id: 'home', label: 'Ana sayfa', description: 'Karşılama ve marka hikâyesi', icon: I.home },
  { id: 'menu', label: 'Menü', description: 'Kategori ve ürün deneyimi', icon: I.cutlery },
  { id: 'auth', label: 'Giriş', description: 'Üyelik, OTP ve OAuth', icon: I.userCircle },
  { id: 'checkout', label: 'Checkout', description: 'Sepet ve ödeme akışı', icon: I.receipt },
]

export function ThemeExperienceSurfaceSelector({
  value,
  homeEnabled,
  onChange,
}: {
  value: ThemeEditorSurface
  homeEnabled: boolean
  onChange: (surface: ThemeEditorSurface) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const active = SURFACES.find((surface) => surface.id === value) ?? SURFACES[1]!
  const ActiveIcon = active.icon

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleEscape)
    requestAnimationFrame(() => optionRefs.current[SURFACES.findIndex((surface) => surface.id === value)]?.focus())
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, value])

  const choose = (surface: ThemeEditorSurface) => {
    onChange(surface)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number
    if (event.key === 'ArrowDown') next = (index + 1) % SURFACES.length
    else if (event.key === 'ArrowUp') next = (index - 1 + SURFACES.length) % SURFACES.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = SURFACES.length - 1
    else return
    event.preventDefault()
    optionRefs.current[next]?.focus()
  }

  return (
    <div ref={rootRef} data-theme-surface-selector style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        data-theme-surface-trigger
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-surface-menu"
        onClick={() => setOpen((current) => !current)}
        style={{
          minWidth: 156,
          height: 36,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          border: '1px solid transparent',
          borderRadius: 9,
          background: open ? 'var(--surface-3)' : 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 700,
        }}
      >
        <ActiveIcon size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>{active.label}</span>
        {value === 'home' && !homeEnabled && (
          <span style={{ color: 'var(--text-3)', fontSize: 10.5, fontWeight: 650 }}>Kapalı</span>
        )}
        <I.chevDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          id="theme-surface-menu"
          role="menu"
          aria-label="Düzenlenecek yüzeyi seç"
          style={{
            position: 'absolute',
            zIndex: 80,
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(320px, calc(100vw - 20px))',
            padding: 8,
            border: '1px solid var(--border-strong)',
            borderRadius: 13,
            background: 'var(--surface)',
            boxShadow: '0 18px 48px rgba(17,19,24,.18), 0 2px 8px rgba(17,19,24,.08)',
          }}
        >
          <div style={{ padding: '8px 10px 7px', color: 'var(--text-3)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Müşteri deneyimi
          </div>
          {SURFACES.map((surface, index) => {
            const Icon = surface.icon
            const selected = surface.id === value
            return (
              <button
                key={surface.id}
                ref={(node) => { optionRefs.current[index] = node }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => choose(surface.id)}
                style={{
                  width: '100%',
                  minHeight: 50,
                  padding: '6px 10px',
                  border: 0,
                  borderRadius: 9,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  background: selected ? 'var(--surface-inset)' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 9, background: selected ? 'var(--surface)' : 'var(--surface-3)', color: selected ? 'var(--text)' : 'var(--text-2)' }}>
                  <Icon size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700 }}>
                    {surface.label}
                    {surface.id === 'home' && !homeEnabled && <span style={{ padding: '2px 6px', borderRadius: 999, background: 'var(--surface-3)', color: 'var(--text-3)', fontSize: 10 }}>Kapalı</span>}
                  </span>
                  <span style={{ display: 'block', marginTop: 2, color: 'var(--text-3)', fontSize: 11.5 }}>{surface.description}</span>
                </span>
                {selected && <I.check size={17} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
