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
  // Settlement method (authenticated payload only; anon's column grant omits it).
  payment_method?: string | null
  /** Adisyon bağlantısı — settle-from-board bunun üzerinden SettlementSheet açar. */
  table_session_id?: string | null
  created_at: string
  // Stage timestamps (P2 trigger-stamped; NULL on pre-migration orders — the
  // UI falls back to created_at, never fabricates). Authenticated payload only.
  sent_to_kitchen_at?: string | null
  ready_at?: string | null
  served_at?: string | null
  cancel_reason?: string | null
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
          // Soft delete arrives as an UPDATE setting deleted_at — drop the card
          // live (the SSR query filters deleted_at; the board must match).
          if (updated['deleted_at'] != null) {
            knownIds.current.delete(updated.id)
            setOrders((prev) => prev.filter((o) => o.id !== updated.id))
            return
          }
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? updated : o)),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          // Hard DELETE: remove the card without a reload. No restaurant filter —
          // DELETE payloads only carry the PK under the default replica identity,
          // so the filter column isn't available. Removing by UUID is safe: only
          // this restaurant's orders ever live in local state.
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
        },
        (payload: { old: Record<string, unknown> }) => {
          const deletedId = (payload.old as { id?: string }).id
          if (!deletedId) return
          knownIds.current.delete(deletedId)
          setOrders((prev) => prev.filter((o) => o.id !== deletedId))
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
