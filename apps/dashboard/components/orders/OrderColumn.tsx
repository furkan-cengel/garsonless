'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Order } from './useOrdersRealtime'
import { sortOrdersByPriorityThenCreatedAt, type OperationalOrderStatus } from '@garsonless/db/browser'
import OrderCard, { type OrderDensity } from './OrderCard'
import { INITIAL_COLUMN_ORDER_LIMIT, boundedColumnWindow } from './order-board-performance'

interface ColumnDef {
  id: string
  label: string
  desc: string
  statuses: OperationalOrderStatus[]
  tone: 'warning' | 'info' | 'positive' | 'neutral'
}

const TONE_COLORS = {
  warning:  { bg: 'var(--warning-bg)',  fg: 'var(--warning)' },
  info:     { bg: 'var(--info-bg)',     fg: 'var(--info)' },
  positive: { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  neutral:  { bg: 'var(--surface-3)',   fg: 'var(--text-2)' },
} as const

interface Props {
  column: ColumnDef
  orders: Order[]
  tableLabels: Record<string, string>
  selectedOrderId: string | null
  onSelectOrder: (order: Order) => void
  onAdvance: (order: Order) => void
  pendingOrderIds: ReadonlySet<string>
  lateThresholdMin?: number
  density?: OrderDensity
}

export default function OrderColumn({ column, orders, tableLabels, selectedOrderId, onSelectOrder, onAdvance, pendingOrderIds, lateThresholdMin, density = 'comfortable' }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const tone = TONE_COLORS[column.tone]
  const sortedOrders = useMemo(() => sortOrdersByPriorityThenCreatedAt(orders), [orders])
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_COLUMN_ORDER_LIMIT)
  const orderWindow = useMemo(
    () => boundedColumnWindow(sortedOrders, visibleLimit),
    [sortedOrders, visibleLimit],
  )

  useEffect(() => {
    setVisibleLimit(INITIAL_COLUMN_ORDER_LIMIT)
  }, [column.id, orders])

  const headingId = `orders-column-${column.id}`

  return (
    <section className="orders-column" aria-labelledby={headingId} style={{
      flex: 1, minWidth: 220,
      background: 'var(--surface-2)', borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      border: '1px solid var(--divider)',
      outline: isOver ? '2px solid var(--border-strong)' : 'none',
    }}>
      {/* Header */}
      <div className="orders-column-header" style={{
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--divider)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: tone.bg, color: tone.fg,
            padding: '2px 8px', borderRadius: 999,
            fontSize: 11.5, fontWeight: 600,
          }} aria-label={`${orders.length} sipariş`}>{orders.length}</span>
          <div>
            <div id={headingId} style={{ fontWeight: 600, fontSize: 13 }}>{column.label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{column.desc}</div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1, overflow: 'auto', padding: density === 'dense' ? 6 : density === 'compact' ? 8 : 10,
          display: 'flex', flexDirection: 'column', gap: density === 'dense' ? 5 : density === 'compact' ? 6 : 8,
          minHeight: 120,
        }}
      >
        <SortableContext items={orderWindow.visible.map(o => o.id)} strategy={verticalListSortingStrategy}>
          {orderWindow.visible.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              tableLabel={tableLabels[order.table_id ?? ''] ?? (order.table_id ? 'Masa' : 'Walk-in')}
              active={selectedOrderId === order.id}
              onClick={() => onSelectOrder(order)}
              onAdvance={onAdvance}
              actionPending={pendingOrderIds.has(order.id)}
              lateThresholdMin={lateThresholdMin}
              density={density}
            />
          ))}
        </SortableContext>
        {sortedOrders.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>
            Sipariş yok
          </div>
        )}
        {orderWindow.hiddenCount > 0 && (
          <button
            type="button"
            className="orders-load-more orders-touch-target"
            onClick={() => setVisibleLimit(orderWindow.nextLimit)}
            style={{
              minHeight: 40,
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 650,
            }}
          >
            {Math.min(orderWindow.hiddenCount, orderWindow.nextLimit - orderWindow.visible.length)} sipariş daha göster
            <span className="sr-only"> · {orderWindow.hiddenCount} sipariş henüz gösterilmiyor</span>
          </button>
        )}
      </div>
    </section>
  )
}
