'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { canTransitionOrderStatus, type OperationalOrderStatus, type OrderLifecycleTarget } from '@garsonless/db/browser'
import type { Order } from './useOrdersRealtime'
import OrderColumn from './OrderColumn'
import OrderCard, { type OrderDensity } from './OrderCard'

interface ColumnDef {
  id: string
  label: string
  desc: string
  statuses: OperationalOrderStatus[]
  targetStatus: OrderLifecycleTarget | null
  tone: 'warning' | 'info' | 'positive' | 'neutral'
}

interface Props {
  columns: ColumnDef[]
  filteredOrders: Order[]
  orders: Order[]
  tableLabels: Record<string, string>
  selectedOrderId: string | null
  onSelectOrder: (order: Order | null) => void
  onAdvance: (order: Order) => void
  onMove: (order: Order, target: OrderLifecycleTarget) => void
  /** Surface a failed server write (the optimistic move gets rolled back). */
  onActionError: (msg: string) => void
  pendingOrderIds: ReadonlySet<string>
  lateThresholdMin?: number
  density?: OrderDensity
}

export default function OrderBoardDnd({
  columns,
  filteredOrders,
  orders,
  tableLabels,
  selectedOrderId,
  onSelectOrder,
  onAdvance,
  onMove,
  onActionError,
  pendingOrderIds,
  lateThresholdMin,
  density = 'comfortable',
}: Props) {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )
  const ordersByColumn = useMemo(() => Object.fromEntries(
    columns.map((column) => [
      column.id,
      filteredOrders.filter((order) => column.statuses.includes(order.status)),
    ]),
  ), [columns, filteredOrders]) as Record<string, Order[]>

  function handleDragStart(event: DragStartEvent) {
    setActiveOrder(orders.find(o => o.id === event.active.id) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null)
    const { active, over } = event
    if (!over) return
    const order = orders.find(o => o.id === active.id)
    if (!order) return
    if (pendingOrderIds.has(order.id)) return
    const targetColumn = columns.find(c => c.id === over.id)
    if (!targetColumn || targetColumn.statuses.includes(order.status)) return
    // Transition matrix (shared with the server guard): an illegal drag —
    // backwards/skip (e.g. Hazır→Yeni, Yeni→Tamamlandı) — never moves the card
    // optimistically and never hits the server.
    if (!targetColumn.targetStatus || !canTransitionOrderStatus(order.status, targetColumn.targetStatus)) {
      onActionError('Geçersiz taşıma — sipariş bu duruma alınamaz.')
      return
    }
    onMove(order, targetColumn.targetStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="orders-kanban" style={{ display: 'flex', gap: 12, minWidth: 'max-content', height: '100%' }}>
        {columns.map(col => (
          <OrderColumn
            key={col.id}
            column={col}
            orders={ordersByColumn[col.id] ?? []}
            tableLabels={tableLabels}
            selectedOrderId={selectedOrderId}
            onSelectOrder={onSelectOrder}
            onAdvance={onAdvance}
            pendingOrderIds={pendingOrderIds}
            lateThresholdMin={lateThresholdMin}
            density={density}
          />
        ))}
      </div>
      <DragOverlay>
        {activeOrder && (
          <OrderCard
            order={activeOrder}
            tableLabel={tableLabels[activeOrder.table_id ?? ''] ?? 'Walk-in'}
            density={density}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
