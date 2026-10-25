'use client'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import { memo, useRef } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import { sessionDuration, TABLE_OPERATIONAL_COPY, tableOperationalState } from './tables-operation-model'
import { TableStatusBadge } from './TableStatusBadge'
import { tableLayoutDimensions, type TableLayoutDraft } from './table-floor-layout-model'
type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startXBp: number
  startYBp: number
  moved: boolean
}
function formatMoney(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
}

export const TablesFloorCard = memo(function TablesFloorCard({
  table,
  entry,
  session,
  requestCount,
  now,
  active,
  editing,
  colliding,
  canvasRef,
  onSelect,
  onMove,
  onQuickMenu,
}: {
  table: TableItem
  entry: TableLayoutDraft[string]
  session: OpenTableSessionView | undefined
  requestCount: number
  now: number
  active: boolean
  editing: boolean
  colliding: boolean
  canvasRef: RefObject<HTMLDivElement | null>
  onSelect: (tableId: string) => void
  onMove: (tableId: string, xBp: number, yBp: number) => void
  onQuickMenu: (tableId: string, anchor: HTMLElement, x: number, y: number) => void
}) {
  const dragRef = useRef<DragState | null>(null)
  const state = tableOperationalState(session, now)
  const dimensions = tableLayoutDimensions(entry)
  const sessionAmountLabel = session && session.orderCount > 0
    ? session.unpaidTotal > 0
      ? `${formatMoney(session.unpaidTotal)} açık`
      : `${formatMoney(session.total)} ödendi`
    : null

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editing || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXBp: entry.xBp,
      startYBp: entry.yBp,
      moved: false,
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return
    const bounds = canvas.getBoundingClientRect()
    const deltaX = event.clientX - drag.startClientX
    const deltaY = event.clientY - drag.startClientY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true
    onMove(
      table.id,
      drag.startXBp + (deltaX / Math.max(1, bounds.width)) * 10000,
      drag.startYBp + (deltaY / Math.max(1, bounds.height)) * 10000,
    )
  }

  const endPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    window.setTimeout(() => { dragRef.current = null }, 0)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!editing && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
      event.preventDefault()
      const bounds = event.currentTarget.getBoundingClientRect()
      onQuickMenu(table.id, event.currentTarget, bounds.left + Math.min(bounds.width - 12, 42), bounds.top + 32)
      return
    }
    if (!editing || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 500 : 100
    onMove(
      table.id,
      entry.xBp + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
      entry.yBp + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
    )
  }

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (editing) return
    event.preventDefault()
    const anchor = event.target instanceof HTMLElement
      ? event.target.closest('button') ?? event.currentTarget
      : event.currentTarget
    onQuickMenu(table.id, anchor, event.clientX, event.clientY)
  }
  return (
    <article
      data-table-id={table.id}
      className={`tb-floor-card tb-floor-card--${state}${active ? ' is-active' : ''}${editing ? ' is-editing' : ''}${colliding ? ' is-colliding' : ''}`}
      onContextMenu={openContextMenu}
      style={{ left: `${entry.xBp / 100}%`, top: `${entry.yBp / 100}%`, width: `${dimensions.widthBp / 100}%`, height: `${dimensions.heightBp / 100}%` }}
    >
      <button
        type="button"
        className="tb-floor-card__main"
        aria-label={`${table.label}, ${TABLE_OPERATIONAL_COPY[state]}, ${entry.seatCount} kişilik${session ? `, ${session.orderCount} sipariş${sessionAmountLabel ? `, ${sessionAmountLabel}` : ''}` : ''}${requestCount > 0 ? `, ${requestCount} servis isteği` : ''}`}
        aria-pressed={active}
        aria-grabbed={editing ? active : undefined}
        onClick={() => { if (!dragRef.current?.moved) onSelect(table.id) }}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <span className="tb-floor-card__topline">
          <TableStatusBadge state={state} />
          {requestCount > 0 && <span className="tb-floor-card__request" title={`${requestCount} servis isteği`}><AppIcons.bell size={11} aria-hidden="true" />{requestCount}</span>}
          {editing && <AppIcons.drag size={15} aria-hidden="true" className="tb-floor-card__grip" />}
        </span>
        <strong className="tb-floor-card__label" title={table.label}>{table.label}</strong>
        <span className="tb-floor-card__meta">{session ? `${session.orderCount} sipariş · ${sessionDuration(session.openedAt, now)}` : 'Sipariş yok'}</span>
        <span className={`tb-floor-card__amount is-${state}`}>{session ? sessionAmountLabel : 'Müsait'}</span>
        <span className="tb-floor-card__footer">
          <span title={`${entry.seatCount} kişilik masa`}><AppIcons.chair size={12} aria-hidden="true" />{entry.seatCount} kişilik</span>
          <span title={`QR adresindeki masa kodu: ${table.slug}`}>#{table.slug}</span>
        </span>
      </button>
      {!editing && <button type="button" className="tb-floor-card__more" aria-label={`${table.label} hızlı işlemleri`} onClick={(event) => {
        event.stopPropagation()
        const bounds = event.currentTarget.getBoundingClientRect()
        onQuickMenu(table.id, event.currentTarget, bounds.right - 220, bounds.bottom + 6)
      }}><AppIcons.more size={17} /></button>}
    </article>
  )
})
