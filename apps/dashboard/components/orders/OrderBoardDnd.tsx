'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { OrderStatus } from '@garsonless/db/order-client'
import type { Order } from './useOrdersRealtime'
import OrderColumn from './OrderColumn'
import OrderCard from './OrderCard'
import { updateOrderStatus } from '../../lib/actions/orders'

interface ColumnDef {
  id: string
  label: string
  desc: string
  statuses: OrderStatus[]
  targetStatus: OrderStatus
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
  updateOrderLocally: (id: string, status: OrderStatus) => void
  restaurantId: string
  /** Surface a failed server write (the optimistic move gets rolled back). */
  onActionError: (msg: string) => void
}

export default function OrderBoardDnd({
  columns,
  filteredOrders,
  orders,
  tableLabels,
  selectedOrderId,
  onSelectOrder,
  onAdvance,
  updateOrderLocally,
  restaurantId,
  onActionError,
}: Props) {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveOrder(orders.find(o => o.id === event.active.id) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null)
    const { active, over } = event
    if (!over) return
    const order = orders.find(o => o.id === active.id)
    if (!order) return
    const targetColumn = columns.find(c => c.id === over.id)
    if (!targetColumn || targetColumn.statuses.includes(order.status as OrderStatus)) return
    const prev = order.status as OrderStatus
    updateOrderLocally(order.id, targetColumn.targetStatus)
    // Typed {error} AND thrown exceptions (network/500) both roll back — never
    // leave a card silently stuck in a column the server rejected.
    let error: string | null = null
    try {
      const result = await updateOrderStatus(order.id, targetColumn.targetStatus, restaurantId)
      if ('error' in result) error = result.error
    } catch {
      error = 'Sunucuya ulaşılamadı'
    }
    if (error) {
      updateOrderLocally(order.id, prev)
      onActionError(`Durum güncellenemedi: ${error}`)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', height: '100%' }}>
        {columns.map(col => (
          <OrderColumn
            key={col.id}
            column={col}
            orders={filteredOrders.filter(o => col.statuses.includes(o.status as OrderStatus))}
            tableLabels={tableLabels}
            selectedOrderId={selectedOrderId}
            onSelectOrder={onSelectOrder}
            onAdvance={onAdvance}
          />
        ))}
      </div>
      <DragOverlay>
        {activeOrder && (
          <OrderCard
            order={activeOrder}
            tableLabel={tableLabels[activeOrder.table_id ?? ''] ?? 'Walk-in'}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
