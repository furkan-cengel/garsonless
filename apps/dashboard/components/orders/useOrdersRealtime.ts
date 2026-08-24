'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type { OperationalOrderStatus } from '@garsonless/db/browser'
import { OPEN_ORDER_STATUSES } from '@garsonless/domain/orders'
import {
  ORDERS_REALTIME_SAFETY_INTERVAL_MS,
  ORDERS_REALTIME_DEBOUNCE_MS,
  canonicalOrderSnapshot,
  normalizeRealtimeOrder,
  rollbackOrderStatus,
  type OrdersRealtimeStatus,
} from './order-realtime-model'

export type Order = {
  id: string
  restaurant_id: string
  table_id: string | null
  session_id?: string | null
  customer_id?: string | null
  status: OperationalOrderStatus
  source: 'customer' | 'staff'
  items: unknown
  total: number
  discount_breakdown?: unknown
  customer_tier: unknown
  paid_at: string | null
  payment_method?: string | null
  table_session_id?: string | null
  created_at: string
  sent_to_kitchen_at?: string | null
  ready_at?: string | null
  served_at?: string | null
  cancel_reason?: string | null
  cancelled_by?: string | null
  settled_by?: string | null
  updated_at?: string
  [key: string]: unknown
}

const ORDER_SELECT = 'id, restaurant_id, table_id, table_session_id, session_id, customer_id, status, source, items, total, discount_breakdown, customer_tier, paid_at, payment_method, created_at, sent_to_kitchen_at, ready_at, served_at, cancel_reason, cancelled_by, settled_by, updated_at, deleted_at'

export function useOrdersRealtime(
  restaurantId: string,
  initialOrders: Order[],
  initialSince: string,
) {
  const supabase = useMemo(() => createDashboardBrowserClient(), [])
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [connectionStatus, setConnectionStatus] = useState<OrdersRealtimeStatus>('connecting')
  const [subscriptionGeneration, setSubscriptionGeneration] = useState(0)
  const mountedRef = useRef(true)
  const reconciliationRevisionRef = useRef(0)
  const optimisticTokensRef = useRef(new Map<string, number>())
  const nextOptimisticTokenRef = useRef(0)
  const failedReconcilesRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      reconciliationRevisionRef.current += 1
    }
  }, [])

  const readSnapshot = useCallback(async (): Promise<Order[] | null> => {
    const pageSize = 500
    const fetchPages = async (statuses: readonly string[], updatedSince?: string) => {
      const rows: Order[] = []
      for (let from = 0; ; from += pageSize) {
        let query = supabase
          .from('orders')
          .select(ORDER_SELECT)
          .eq('restaurant_id', restaurantId)
          .in('status', [...statuses])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (updatedSince) query = query.gte('updated_at', updatedSince)
        const { data, error } = await query.range(from, from + pageSize - 1)
        if (error) return null
        const page = (data ?? []).map((row) => normalizeRealtimeOrder(row as Record<string, unknown>))
        if (page.some((row) => row === null)) return null
        rows.push(...(page as Order[]))
        if (page.length < pageSize) break
      }
      return rows
    }

    const [openOrders, terminalOrders] = await Promise.all([
      fetchPages(OPEN_ORDER_STATUSES),
      fetchPages(['served', 'cancelled'], initialSince),
    ])
    return openOrders && terminalOrders
      ? canonicalOrderSnapshot([...openOrders, ...terminalOrders])
      : null
  }, [initialSince, restaurantId, supabase])

  const reconcileOrders = useCallback(async (): Promise<boolean> => {
    const revision = ++reconciliationRevisionRef.current
    let fresh: Order[] | null
    try {
      fresh = await readSnapshot()
    } catch {
      return false
    }
    if (!mountedRef.current || revision !== reconciliationRevisionRef.current || !fresh) return false
    optimisticTokensRef.current.clear()
    setOrders(fresh)
    return true
  }, [readSnapshot])

  const retryRealtime = useCallback(() => {
    if (!mountedRef.current) return
    failedReconcilesRef.current = 0
    setConnectionStatus('reconnecting')
    setSubscriptionGeneration((generation) => generation + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    let socketSubscribed = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    let debounceTimer: number | null = null

    const reconcileLive = async (announce = false) => {
      if (cancelled) return
      // Routine invalidations are normal operation, not a connection problem.
      // Keep the board visibly live while the fresh snapshot is reconciled.
      if (announce) setConnectionStatus('reconnecting')
      const ok = await reconcileOrders()
      if (cancelled) return
      if (ok && socketSubscribed) {
        failedReconcilesRef.current = 0
        setConnectionStatus('live')
        return
      }
      failedReconcilesRef.current += 1
      setConnectionStatus(socketSubscribed && failedReconcilesRef.current >= 2 ? 'stale' : socketSubscribed ? 'reconnecting' : 'offline')
    }

    const scheduleReconcile = () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        void reconcileLive(false)
      }, ORDERS_REALTIME_DEBOUNCE_MS)
    }

    const subscribe = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (!data.session) {
          setConnectionStatus('offline')
          return
        }
        await supabase.realtime.setAuth(data.session.access_token)
        if (cancelled) return

        channel = supabase
          .channel(`orders-invalidations:${restaurantId}:${subscriptionGeneration}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'pano_invalidations', filter: `restaurant_id=eq.${restaurantId}`,
          }, (payload: { new: Record<string, unknown> }) => {
            if (payload.new['source'] === 'orders') scheduleReconcile()
          })
          .subscribe((status) => {
            if (cancelled) return
            if (status === 'SUBSCRIBED') {
              socketSubscribed = true
              setConnectionStatus(subscriptionGeneration > 0 ? 'reconnecting' : 'connecting')
              void reconcileLive(false)
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              socketSubscribed = false
              setConnectionStatus('reconnecting')
            } else if (status === 'CLOSED') {
              socketSubscribed = false
              setConnectionStatus('offline')
            }
          })
      } catch {
        if (!cancelled) setConnectionStatus('offline')
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (!session) {
        socketSubscribed = false
        setConnectionStatus('offline')
      } else {
        void supabase.realtime.setAuth(session.access_token).catch(() => {
          if (!cancelled) setConnectionStatus('offline')
        })
      }
    })

    const reconcileVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!socketSubscribed) {
        retryRealtime()
        return
      }
      void reconcileLive(false)
    }
    const handleOnline = () => retryRealtime()
    const handleOffline = () => {
      socketSubscribed = false
      setConnectionStatus('offline')
    }
    const safetyTimer = window.setInterval(reconcileVisible, ORDERS_REALTIME_SAFETY_INTERVAL_MS)
    document.addEventListener('visibilitychange', reconcileVisible)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (navigator.onLine === false) setConnectionStatus('offline')
    else void subscribe()

    return () => {
      cancelled = true
      socketSubscribed = false
      reconciliationRevisionRef.current += 1
      window.clearInterval(safetyTimer)
      if (debounceTimer !== null) window.clearTimeout(debounceTimer)
      document.removeEventListener('visibilitychange', reconcileVisible)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      authListener.subscription.unsubscribe()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [reconcileOrders, restaurantId, retryRealtime, subscriptionGeneration, supabase])

  function startOptimisticOrderStatus(orderId: string, status: OperationalOrderStatus): number {
    const token = ++nextOptimisticTokenRef.current
    optimisticTokensRef.current.set(orderId, token)
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order))
    return token
  }

  function commitOptimisticOrderStatus(orderId: string, token: number) {
    if (optimisticTokensRef.current.get(orderId) === token) optimisticTokensRef.current.delete(orderId)
  }

  function rollbackOptimisticOrderStatus(
    orderId: string,
    token: number,
    optimisticStatus: OperationalOrderStatus,
    fallbackStatus: OperationalOrderStatus,
  ) {
    if (optimisticTokensRef.current.get(orderId) !== token) return
    optimisticTokensRef.current.delete(orderId)
    setOrders((current) => rollbackOrderStatus(current, orderId, optimisticStatus, fallbackStatus))
  }

  return {
    orders,
    connectionStatus,
    retryRealtime,
    reconcileOrders,
    startOptimisticOrderStatus,
    commitOptimisticOrderStatus,
    rollbackOptimisticOrderStatus,
  }
}
