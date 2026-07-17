'use client'

import type { ReactNode } from 'react'

import { I, IconButton } from '../../lib/ui'

interface Props {
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

export function MenuItemEditorFrame({
  itemId,
  itemName,
  position,
  createdAt,
  updatedAt,
  tint,
  onClose,
  children,
  footer,
  overlay,
}: Props) {
  return (
    <aside
      className="menu-item-editor"
      style={{
        width: 'var(--props)', minWidth: 0, flexShrink: 0, overflow: 'hidden',
        borderLeft: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
      }}
      data-item-id={itemId}
      data-item-position={position}
      data-item-created-at={createdAt}
      data-item-updated-at={updatedAt}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
          <I.cutlery size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.2 }}>{itemName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>#{itemId.slice(0, 8)}</div>
        </div>
        <IconButton icon={<I.close size={15} />} ariaLabel="Kapat" onClick={onClose} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>{children}</div>
      <div style={{
        borderTop: '1px solid var(--divider)', padding: '10px 16px 12px',
        background: 'var(--surface-2)',
      }}>
        {footer}
      </div>
      {overlay}
    </aside>
  )
}
