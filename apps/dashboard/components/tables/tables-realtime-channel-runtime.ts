import type { Dispatch, SetStateAction } from 'react'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { TABLES_REALTIME_SAFETY_INTERVAL_MS, type TablesRealtimeStatus } from './tables-realtime-model'

type Refresh = () => Promise<boolean>
type InvalidationSource = 'orders' | 'table_sessions' | 'payment_shares' | 'service_requests' | 'tables'

export type TablesRealtimeRuntimeInput = {
  restaurantId: string
  reconcile: Refresh
  refreshSessions: Refresh
  refreshPendingRequests: Refresh
  refreshTableDirectory: Refresh
  onLayoutInvalidated: () => void
  retryRealtime?: () => void
  setConnectionStatus: Dispatch<SetStateAction<TablesRealtimeStatus>>
}

export function startTablesRealtimeRuntime({
  restaurantId, reconcile, refreshSessions, refreshPendingRequests,
  refreshTableDirectory, onLayoutInvalidated, retryRealtime = () => undefined,
  setConnectionStatus,
}: TablesRealtimeRuntimeInput): () => void {
  const supabase = createDashboardBrowserClient()
  let cancelled = false
  let hasSubscribed = false
  let socketSubscribed = false
  let sessionTimer: number | null = null
  let requestTimer: number | null = null
  let tableTimer: number | null = null
  let consecutiveSafetyFailures = 0

  const settleStatus = (ok: boolean) => {
    if (cancelled) return
    if (ok && socketSubscribed) {
      consecutiveSafetyFailures = 0
      setConnectionStatus('live')
    } else {
      setConnectionStatus(socketSubscribed ? 'reconnecting' : 'offline')
    }
  }
  const schedule = (kind: 'session' | 'request' | 'table') => {
    const current = kind === 'session' ? sessionTimer : kind === 'request' ? requestTimer : tableTimer
    if (current !== null) window.clearTimeout(current)
    const timer = window.setTimeout(() => {
      if (kind === 'session') sessionTimer = null
      else if (kind === 'request') requestTimer = null
      else tableTimer = null
      const refresh = kind === 'session' ? refreshSessions : kind === 'request' ? refreshPendingRequests : refreshTableDirectory
      void refresh().then((ok) => {
        if (kind === 'table' && ok) onLayoutInvalidated()
        settleStatus(ok)
      })
    }, 180)
    if (kind === 'session') sessionTimer = timer
    else if (kind === 'request') requestTimer = timer
    else tableTimer = timer
  }

  const scheduleInvalidation = (source: InvalidationSource) => {
    if (source === 'service_requests') schedule('request')
    else if (source === 'tables') schedule('table')
    else schedule('session')
  }

  const channel = supabase
    .channel(`tables-live:${restaurantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pano_invalidations', filter: `restaurant_id=eq.${restaurantId}` },
      (payload: { new: Record<string, unknown> }) => {
        const source = payload.new['source']
        if (source === 'orders' || source === 'table_sessions' || source === 'payment_shares' || source === 'service_requests' || source === 'tables') {
          scheduleInvalidation(source)
        } else {
          void reconcile().then(settleStatus)
        }
      },
    )

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
      channel.subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          setConnectionStatus(hasSubscribed ? 'reconnecting' : 'connecting')
          hasSubscribed = true
          socketSubscribed = true
          void reconcile().then(settleStatus)
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
    } else void supabase.realtime.setAuth(session.access_token).catch(() => {
      if (!cancelled) setConnectionStatus('offline')
    })
  })
  const reconcileVisible = () => {
    if (document.visibilityState !== 'visible') return
    if (!socketSubscribed) retryRealtime()
    else void reconcile().then((ok) => {
      if (cancelled) return
      if (ok) {
        consecutiveSafetyFailures = 0
        setConnectionStatus('live')
        return
      }
      consecutiveSafetyFailures += 1
      setConnectionStatus(consecutiveSafetyFailures >= 2 ? 'stale' : 'reconnecting')
    })
  }
  const handleOnline = () => retryRealtime()
  const handleOffline = () => {
    socketSubscribed = false
    setConnectionStatus('offline')
  }
  const safetyTimer = window.setInterval(reconcileVisible, TABLES_REALTIME_SAFETY_INTERVAL_MS)
  document.addEventListener('visibilitychange', reconcileVisible)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  void subscribe()

  return () => {
    cancelled = true
    socketSubscribed = false
    if (sessionTimer !== null) window.clearTimeout(sessionTimer)
    if (requestTimer !== null) window.clearTimeout(requestTimer)
    if (tableTimer !== null) window.clearTimeout(tableTimer)
    window.clearInterval(safetyTimer)
    document.removeEventListener('visibilitychange', reconcileVisible)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    authListener.subscription.unsubscribe()
    void supabase.removeChannel(channel)
  }
}
