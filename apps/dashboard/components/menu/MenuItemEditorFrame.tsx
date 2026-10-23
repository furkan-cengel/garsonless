'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { MenuProductPanelHeader } from './MenuProductPanelChrome'

interface Props {
  busy?: boolean
  itemId: string
  title: string
  subtitle: string
  position: number
  createdAt: string
  updatedAt: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  overlay?: ReactNode
}

export function MenuItemEditorFrame({ busy = false, itemId, title, subtitle, position, createdAt, updatedAt, onClose, children, footer, overlay }: Props) {
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
      data-menu-item-panel={itemId}
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
      <MenuProductPanelHeader headingId={headingId} headingRef={headingRef} title={title} subtitle={subtitle} closeLabel="Kapat" busy={busy} onClose={onClose} />
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
