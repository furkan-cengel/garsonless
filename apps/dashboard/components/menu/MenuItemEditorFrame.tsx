'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

import { useEffect, useRef, type ReactNode } from 'react'

import { I } from '../../lib/ui'

interface Props {
  busy?: boolean
  itemId: string
  itemName: string
  position: number
  createdAt: string
  updatedAt: string
  tint: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  overlay?: ReactNode
}

export function MenuItemEditorFrame({ busy = false, itemId, itemName, position, createdAt, updatedAt, tint, onClose, children, footer, overlay }: Props) {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const headingRef = useRef<HTMLDivElement>(null)
  const headingId = `menu-item-editor-${itemId}`

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside
      className="menu-item-editor"
      aria-labelledby={headingId}
      style={{
        width: 'var(--props)',
        minWidth: 0,
        minHeight: 0,
        flexShrink: 0,
        overflow: 'hidden',
        overscrollBehaviorY: 'contain',
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-item-id={itemId}
      data-item-position={position}
      data-item-created-at={createdAt}
      data-item-updated-at={updatedAt}
    >
      <Link className="px-4 py-2 text-sm underline" href={`/dashboard/${restaurantId}/inventory?menuItemId=${itemId}`}>Stok ve reçete</Link>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--divider)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: tint,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
          }}
        >
          <I.menuDish size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div ref={headingRef} tabIndex={-1} id={headingId} style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.2, outline: 'none' }}>
            {itemName} ürününü düzenle
          </div>
          <div className="menu-secondary-text" style={{ fontSize: 11, color: 'var(--text-2)' }}>#{itemId.slice(0, 8)}</div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Kapat" disabled={busy} onClick={onClose}>
          <I.close size={15} />
        </Button>
      </div>
      <div
        className="menu-item-editor-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain' }}
      >
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>
      </div>
      <div
        style={{
          borderTop: '1px solid var(--divider)',
          padding: '10px 16px 12px',
          background: 'var(--surface-2)',
        }}
      >
        {footer}
      </div>
      {overlay}
    </aside>
  )
}
