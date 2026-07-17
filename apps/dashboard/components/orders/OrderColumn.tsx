'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Order } from './useOrdersRealtime'
import { sortOrdersByPriorityThenCreatedAt, type OrderStatus } from '@garsonless/db/browser'
import OrderCard, { type OrderDensity } from './OrderCard'

interface ColumnDef {
  id: string
  label: string
  desc: string
  statuses: OrderStatus[]
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
  lateThresholdMin?: number
  density?: OrderDensity
}

export default function OrderColumn({ column, orders, tableLabels, selectedOrderId, onSelectOrder, onAdvance, lateThresholdMin, density = 'comfortable' }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const tone = TONE_COLORS[column.tone]
  const sortedOrders = sortOrdersByPriorityThenCreatedAt(orders)

  return (
    <div style={{
      flex: 1, minWidth: 220,
      background: 'var(--surface-2)', borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      border: '1px solid var(--divider)',
      outline: isOver ? '2px solid var(--border-strong)' : 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--divider)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: tone.bg, color: tone.fg,
            padding: '2px 8px', borderRadius: 999,
            fontSize: 11.5, fontWeight: 600,
          }}>{orders.length}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{column.label}</div>
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
        <SortableContext items={sortedOrders.map(o => o.id)} strategy={verticalListSortingStrategy}>
          {sortedOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              tableLabel={tableLabels[order.table_id ?? ''] ?? (order.table_id ? 'Masa' : 'Walk-in')}
              active={selectedOrderId === order.id}
              onClick={() => onSelectOrder(order)}
              onAdvance={onAdvance}
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
      </div>
    </div>
  )
}
