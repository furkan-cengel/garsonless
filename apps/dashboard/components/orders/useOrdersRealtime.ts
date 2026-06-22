'use client'

import { useState, useEffect, useRef } from 'react'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type { OrderStatus } from '@garsonless/db/order-client'

export type Order = {
  id: string
  restaurant_id: string
  table_id: string | null
  status: string
  items: unknown
  total: number
  customer_tier: unknown
  paid_at: string | null
  created_at: string
  [key: string]: unknown
}

export function useOrdersRealtime(
  restaurantId: string,
  initialOrders: Order[],
) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [newOrderEvent, setNewOrderEvent] = useState<Order | null>(null)
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)))

  useEffect(() => {
    const supabase = createDashboardBrowserClient()

    const channel = supabase
      .channel(`orders:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const order = payload.new as Order
          if (knownIds.current.has(order.id)) return
          knownIds.current.add(order.id)
          setOrders((prev) => [order, ...prev])
          setNewOrderEvent(order)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as Order
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? updated : o)),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [restaurantId])

  function clearNewOrderEvent() {
    setNewOrderEvent(null)
  }

  function updateOrderLocally(orderId: string, status: OrderStatus) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
    )
  }

  return { orders, newOrderEvent, clearNewOrderEvent, updateOrderLocally }
}
