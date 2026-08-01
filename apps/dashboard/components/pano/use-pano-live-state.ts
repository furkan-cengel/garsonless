'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchPanoSnapshot } from '../../lib/actions/pano'
import { createDashboardBrowserClient } from '../../lib/supabase'
import type { ActivityEvent, PanoSnapshot, TableStatusData } from '../../lib/queries/pano'
import {
  PANO_EVENT_DEBOUNCE_MS,
  PANO_RECONCILE_INTERVAL_MS,
  projectPanoLiveStatus,
  type PanoChannelStatus,
  type PanoLiveStatus,
} from './pano-live-model'

type PanoLiveSnapshot = Omit<PanoSnapshot, 'timezone' | 'initialFeed' | 'tableStatuses'>

export type PanoLiveState = {
  snapshot: PanoLiveSnapshot
  feed: ActivityEvent[]
  tableStatuses: TableStatusData[]
  realtime: PanoLiveStatus
  updatedAt: Date
  refreshing: boolean
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
  const [statusNow, setStatusNow] = useState(() => new Date(initialSnapshot.generatedAt).getTime())
  const [refreshError, setRefreshError] = useState<string | null>(initialSnapshot.errors[0] ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [channelAttempt, setChannelAttempt] = useState(0)
  const refreshTimer = useRef<number | null>(null)
  const refreshInFlight = useRef<Promise<boolean> | null>(null)
  const hasSubscribed = useRef(false)
  const labelByTableId = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    labelByTableId.current = new Map(tableStatuses.map((table) => [table.id, table.label]))
  }, [tableStatuses])

  useEffect(() => {
    const timer = window.setInterval(() => setStatusNow(Date.now()), 15_000)
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
        return false
      }

      const { timezone: _timezone, initialFeed: nextFeed, tableStatuses: nextTables, ...nextSnapshot } = result.snapshot
      setSnapshot(nextSnapshot)
      setFeed(nextFeed)
      setTableStatuses(nextTables)
      const successfulAt = new Date(result.snapshot.generatedAt)
      setUpdatedAt(successfulAt)
      setStatusNow(successfulAt.getTime())
      setRefreshError(nextSnapshot.errors[0] ?? null)
      return true
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
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => void refreshSnapshot(), PANO_EVENT_DEBOUNCE_MS)
  }, [refreshSnapshot])

  const updateFeedStatus = useCallback((orderId: string, status: string) => {
    setFeed((current) => current.map((event) => (
      event.id === orderId ? { ...event, status } : event
    )))
  }, [])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    setChannelStatus('connecting')
    const invalidate = () => scheduleSnapshotRefresh()
    const channel = supabase
      .channel(`pano:${restaurantId}:${channelAttempt}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        invalidate()
        const row = payload.new as Partial<{
          id: string; status: string; total: number; table_id: string | null; created_at: string
        }>
        if (!row.id || !row.status) return
        if (payload.eventType === 'UPDATE') {
          updateFeedStatus(row.id, row.status)
          return
        }
        if (payload.eventType !== 'INSERT' || typeof row.total !== 'number' || !row.created_at) return
        setFeed((current) => [{
          id: row.id!, status: row.status!, total: row.total!, tableId: row.table_id ?? null,
          tableLabel: row.table_id ? labelByTableId.current.get(row.table_id) ?? null : null,
          createdAt: row.created_at!,
        }, ...current.filter((event) => event.id !== row.id)].slice(0, 7))
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'table_sessions', filter: `restaurant_id=eq.${restaurantId}`,
      }, invalidate)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'payment_shares', filter: `restaurant_id=eq.${restaurantId}`,
      }, invalidate)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'service_requests', filter: `restaurant_id=eq.${restaurantId}`,
      }, invalidate)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}`,
      }, invalidate)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const reconnect = hasSubscribed.current
          hasSubscribed.current = true
          setChannelStatus('live')
          if (reconnect) void refreshSnapshot()
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannelStatus('offline')
        } else {
          setChannelStatus('connecting')
        }
      })

    const handleOffline = () => setChannelStatus('offline')
    const handleOnline = () => setChannelAttempt((current) => current + 1)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      void supabase.removeChannel(channel)
    }
  }, [channelAttempt, refreshSnapshot, restaurantId, scheduleSnapshotRefresh, updateFeedStatus])

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
    lastSuccessfulAt: updatedAt.getTime(),
    now: statusNow,
    refreshFailed: refreshError !== null,
  }), [channelStatus, refreshError, statusNow, updatedAt])

  return {
    snapshot,
    feed,
    tableStatuses,
    realtime,
    updatedAt,
    refreshing,
    refreshSnapshot,
    retryLive,
    updateFeedStatus,
  }
}
