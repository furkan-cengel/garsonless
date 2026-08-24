'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchPanoSnapshot } from '../../lib/actions/pano'
import type { ActivityEvent, TableStatusData } from '../../lib/queries/pano'
import { mergePanoRefresh, type PanoLiveSnapshot } from './pano-snapshot-model'
import {
  PANO_EVENT_DEBOUNCE_MS,
  PANO_EVENT_MAX_WAIT_MS,
  PANO_RECONCILE_INTERVAL_MS,
  panoReconnectDelay,
  projectPanoLiveStatus,
  type PanoChannelStatus,
  type PanoLiveStatus,
} from './pano-live-model'

export type PanoLiveState = {
  snapshot: PanoLiveSnapshot
  feed: ActivityEvent[]
  tableStatuses: TableStatusData[]
  realtime: PanoLiveStatus
  updatedAt: Date
  refreshing: boolean
  retainedData: boolean
  now: Date
  refreshSnapshot: () => Promise<boolean>
  retryLive: () => Promise<void>
  updateFeedStatus: (orderId: string, status: string) => void
}

/**
 * Owns one tenant-scoped Realtime channel and treats every payload as an
 * invalidation signal. The authoritative state always comes back through the
 * server snapshot; bursts, reconnects and visibility changes share one
 * in-flight-deduplicated refresh boundary.
 */
export function usePanoLiveState({
  restaurantId,
  initialSnapshot,
  initialFeed,
  initialTableStatuses,
}: {
  restaurantId: string
  initialSnapshot: PanoLiveSnapshot
  initialFeed: ActivityEvent[]
  initialTableStatuses: TableStatusData[]
}): PanoLiveState {
  const [snapshot, setSnapshot] = useState<PanoLiveSnapshot>(initialSnapshot)
  const [feed, setFeed] = useState<ActivityEvent[]>(initialFeed)
  const [tableStatuses, setTableStatuses] = useState<TableStatusData[]>(initialTableStatuses)
  const [channelStatus, setChannelStatus] = useState<PanoChannelStatus>('connecting')
  const [updatedAt, setUpdatedAt] = useState(() => new Date(initialSnapshot.generatedAt))
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState(() => Date.now())
  const [statusNow, setStatusNow] = useState(() => Date.now())
  const [refreshError, setRefreshError] = useState<string | null>(initialSnapshot.errors[0] ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [retainedData, setRetainedData] = useState(false)
  const [channelAttempt, setChannelAttempt] = useState(0)
  const refreshTimer = useRef<number | null>(null)
  const refreshBurstStartedAt = useRef<number | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const reconnectFailures = useRef(0)
  const refreshInFlight = useRef<Promise<boolean> | null>(null)
  const hasSubscribed = useRef(false)
  const snapshotRef = useRef(snapshot)
  const feedRef = useRef(feed)
  const tableStatusesRef = useRef(tableStatuses)

  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  useEffect(() => { feedRef.current = feed }, [feed])
  useEffect(() => { tableStatusesRef.current = tableStatuses }, [tableStatuses])

  useEffect(() => {
    const observedAt = Date.now()
    setLastSuccessfulAt(observedAt)
    setStatusNow(observedAt)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setStatusNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const refreshSnapshot = useCallback(async (): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current
    const request = (async () => {
      setRefreshing(true)
      const result = await fetchPanoSnapshot(restaurantId)
      if ('error' in result) {
        setRefreshError(result.error)
        setSnapshot((current) => ({ ...current, errors: [result.error] }))
        setRetainedData(true)
        return false
      }

      const merged = mergePanoRefresh(
        snapshotRef.current,
        feedRef.current,
        tableStatusesRef.current,
        result.snapshot,
      )
      snapshotRef.current = merged.snapshot
      feedRef.current = merged.feed
      tableStatusesRef.current = merged.tableStatuses
      setSnapshot(merged.snapshot)
      setFeed(merged.feed)
      setTableStatuses(merged.tableStatuses)
      setRetainedData(merged.retainedData)
      if (merged.fullyFresh) {
        const successfulAt = new Date(result.snapshot.generatedAt)
        const observedAt = Date.now()
        setUpdatedAt(successfulAt)
        setLastSuccessfulAt(observedAt)
        setStatusNow(observedAt)
      }
      setRefreshError(result.snapshot.errors[0] ?? null)
      return merged.fullyFresh
    })()
    refreshInFlight.current = request
    try {
      return await request
    } finally {
      refreshInFlight.current = null
      setRefreshing(false)
    }
  }, [restaurantId])

  const scheduleSnapshotRefresh = useCallback(() => {
    const now = Date.now()
    refreshBurstStartedAt.current ??= now
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    const remaining = Math.max(0, PANO_EVENT_MAX_WAIT_MS - (now - refreshBurstStartedAt.current))
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      refreshBurstStartedAt.current = null
      void refreshSnapshot()
    }, Math.min(PANO_EVENT_DEBOUNCE_MS, remaining))
  }, [refreshSnapshot])

  const updateFeedStatus = useCallback((orderId: string, status: string) => {
    setFeed((current) => current.map((event) => (
      event.id === orderId ? { ...event, status } : event
    )))
  }, [])

  useEffect(() => {
    let disposed = false
    let removeChannel: (() => void) | null = null
    setChannelStatus('connecting')
    const scheduleReconnect = () => {
      if (disposed || reconnectTimer.current !== null || !navigator.onLine) return
      const delay = panoReconnectDelay(reconnectFailures.current)
      reconnectFailures.current += 1
      reconnectTimer.current = window.setTimeout(() => {
        reconnectTimer.current = null
        if (!disposed) setChannelAttempt((current) => current + 1)
      }, delay)
    }
    const connect = async () => {
      const { createDashboardBrowserClient } = await import('../../lib/supabase')
      if (disposed) return
      const supabase = createDashboardBrowserClient()
      const channel = supabase
        .channel(`pano:${restaurantId}:${channelAttempt}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'pano_invalidations', filter: `restaurant_id=eq.${restaurantId}`,
        }, scheduleSnapshotRefresh)
        .subscribe((status) => {
          if (disposed) return
          if (status === 'SUBSCRIBED') {
            const reconnect = hasSubscribed.current
            hasSubscribed.current = true
            reconnectFailures.current = 0
            if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
            reconnectTimer.current = null
            setChannelStatus('live')
            if (reconnect) void refreshSnapshot()
            return
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setChannelStatus('offline')
            scheduleReconnect()
          } else {
            setChannelStatus('connecting')
          }
        })
      removeChannel = () => { void supabase.removeChannel(channel) }
    }
    void connect().catch(() => {
      if (!disposed) {
        setChannelStatus('offline')
        scheduleReconnect()
      }
    })

    const handleOffline = () => setChannelStatus('offline')
    const handleOnline = () => {
      reconnectFailures.current = 0
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
      setChannelAttempt((current) => current + 1)
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      disposed = true
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      refreshTimer.current = null
      refreshBurstStartedAt.current = null
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      removeChannel?.()
    }
  }, [channelAttempt, refreshSnapshot, restaurantId, scheduleSnapshotRefresh])

  useEffect(() => {
    const reconcile = () => {
      if (document.visibilityState === 'visible') void refreshSnapshot()
    }
    const timer = window.setInterval(reconcile, PANO_RECONCILE_INTERVAL_MS)
    document.addEventListener('visibilitychange', reconcile)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', reconcile)
    }
  }, [refreshSnapshot])

  const retryLive = useCallback(async () => {
    setChannelStatus('connecting')
    setChannelAttempt((current) => current + 1)
    await refreshSnapshot()
  }, [refreshSnapshot])

  const realtime = useMemo(() => projectPanoLiveStatus({
    channel: channelStatus,
    lastSuccessfulAt,
    now: statusNow,
    refreshFailed: refreshError !== null,
  }), [channelStatus, lastSuccessfulAt, refreshError, statusNow])
  const now = useMemo(() => new Date(statusNow), [statusNow])

  return {
    snapshot,
    feed,
    tableStatuses,
    realtime,
    updatedAt,
    refreshing,
    retainedData,
    now,
    refreshSnapshot,
    retryLive,
    updateFeedStatus,
  }
}
