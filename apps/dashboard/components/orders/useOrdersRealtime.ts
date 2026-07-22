'use client'

import { useState, useEffect, useRef } from 'react'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type { OrderStatus } from '@garsonless/db/browser'
import { OPEN_ORDER_STATUSES } from '@garsonless/domain/orders'

export type Order = {
  id: string
  restaurant_id: string
  table_id: string | null
  status: string
  items: unknown
  total: number
  discount_breakdown?: unknown
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
  initialSince: string,
) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [newOrderEvent, setNewOrderEvent] = useState<Order | null>(null)
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)))
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const subscribe = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) await supabase.realtime.setAuth(data.session.access_token)
      if (cancelled) return

      channel = supabase.channel(`orders:${restaurantId}`)
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
          if (!knownIds.current.has(updated.id)) {
            // UPDATE can be the first event after a reconnect/race. Treat it as
            // an upsert so an active order can never silently disappear.
            knownIds.current.add(updated.id)
            setOrders((prev) => [updated, ...prev])
            return
          }
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
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
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('live')
          // Reconcile after the initial connection and every reconnect. Realtime
          // delivery is not a durable queue; rows missed while offline must be
          // fetched before the UI may honestly call itself live again.
          const pageSize = 500
          const fetchPages = async (statuses: readonly string[], updatedSince?: string) => {
            const rows: Order[] = []
            for (let from = 0; ; from += pageSize) {
              let query = supabase
                .from('orders')
                .select('id, restaurant_id, table_id, table_session_id, status, items, total, discount_breakdown, customer_tier, paid_at, payment_method, created_at, sent_to_kitchen_at, ready_at, served_at, cancel_reason, deleted_at')
                .eq('restaurant_id', restaurantId)
                .in('status', [...statuses])
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
              if (updatedSince) query = query.gte('updated_at', updatedSince)
              const { data, error } = await query.range(from, from + pageSize - 1)
              if (error) return null
              const page = (data ?? []) as Order[]
              rows.push(...page)
              if (page.length < pageSize) break
            }
            return rows
          }

          const [openOrders, terminalOrders] = await Promise.all([
            fetchPages(OPEN_ORDER_STATUSES),
            fetchPages(['served', 'cancelled'], initialSince),
          ])
          if (openOrders && terminalOrders) {
            const fresh = [...openOrders, ...terminalOrders]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
            knownIds.current = new Set(fresh.map((order) => order.id))
            setOrders(fresh)
          } else {
            setConnectionStatus('offline')
          }
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionStatus('offline')
        } else {
          setConnectionStatus('connecting')
        }
      })
    }

    void subscribe()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [restaurantId, initialSince])

  function clearNewOrderEvent() {
    setNewOrderEvent(null)
  }

  function updateOrderLocally(orderId: string, status: OrderStatus) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
    )
  }

  return { orders, newOrderEvent, clearNewOrderEvent, updateOrderLocally, connectionStatus }
}
