'use client'

import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import type { AppIcon } from '@garsonless/ui/icons'
import { nextMenuIndex, type TableQuickAction, type TableQuickActionId } from './table-quick-actions-model'

const ACTION_ICONS: Record<TableQuickActionId, AppIcon> = {
  details: AppIcons.receipt,
  new_order: AppIcons.plus,
  add_order: AppIcons.plus,
  table_move: AppIcons.arrow,
  order_transfer: AppIcons.section,
  account_transfer: AppIcons.receipt,
  settlement: AppIcons.card,
  close_session: AppIcons.check,
  resolve_request: AppIcons.bell,
  rename: AppIcons.type,
  edit_layout: AppIcons.grid,
  delete: AppIcons.trash,
}

export type TableQuickMenuPosition = { x: number; y: number }

export function TableQuickActionMenu({
  tableLabel,
  actions,
  position,
  restoreFocus,
  onAction,
  onClose,
}: {
  tableLabel: string
  actions: TableQuickAction[]
  position: TableQuickMenuPosition
  restoreFocus: HTMLElement | null
  onAction: (action: TableQuickActionId) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  const [activeIndex, setActiveIndex] = useState(0)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const bounds = menu.getBoundingClientRect()
    setAdjustedPosition({
      x: Math.max(8, Math.min(position.x, window.innerWidth - bounds.width - 8)),
      y: Math.max(8, Math.min(position.y, window.innerHeight - bounds.height - 8)),
    })
  }, [position])

  useEffect(() => {
    itemRefs.current[0]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) onClose()
    }
    const onResize = () => onClose()
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      if (restoreFocus?.isConnected && !restoreFocus.closest('[inert]')) restoreFocus.focus()
    }
  }, [onClose, restoreFocus])

  const moveFocus = (index: number) => {
    setActiveIndex(index)
    itemRefs.current[index]?.focus()
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${tableLabel} hızlı işlemleri`}
      className="tb-quick-menu"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') event.preventDefault()
          onClose()
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        moveFocus(nextMenuIndex(
          activeIndex,
          event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
          actions.length,
        ))
      }}
    >
      <div className="tb-quick-menu__title">{tableLabel}</div>
      {actions.map((action, index) => {
        const Icon = ACTION_ICONS[action.id]
        const disabled = Boolean(action.disabledReason)
        return (
          <button
            key={action.id}
            ref={(element) => { itemRefs.current[index] = element }}
            type="button"
            role="menuitem"
            tabIndex={activeIndex === index ? 0 : -1}
            aria-disabled={disabled}
            className={`tb-quick-menu__item${action.destructive ? ' is-destructive' : ''}${action.separatorBefore ? ' has-separator' : ''}`}
            onFocus={() => setActiveIndex(index)}
            onClick={() => {
              if (disabled) return
              onAction(action.id)
              onClose()
            }}
          >
            <Icon size={15} />
            <span>
              <strong>{action.label}</strong>
              {action.disabledReason && <small>{action.disabledReason}</small>}
            </span>
          </button>
        )
      })}
      <div className="tb-quick-menu__hint">Ok tuşlarıyla gezin · Esc ile kapat</div>
    </div>,
    document.body,
  )
}
