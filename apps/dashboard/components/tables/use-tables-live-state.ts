'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  closeTableSession,
  getOpenTableSessions,
} from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import {
  getPendingServiceRequests,
  resolveServiceRequest,
} from '../../lib/actions/service-requests'
import { createDashboardBrowserClient } from '../../lib/supabase'
import {
  applySessionsToTables,
  removePendingRequest,
  requestsByTable,
  sessionRequiresSettlement,
  sessionsByTable,
} from './tables-builder-model'
import type { PendingTableRequestView, TableItem } from './tables-builder-types'

interface UseTablesLiveStateOptions {
  restaurantId: string
  initialOpenSessions: OpenSessionInfo[]
  initialSessionError: string | null
  setTables: Dispatch<SetStateAction<TableItem[]>>
}

export interface SettlementTarget {
  session: OpenSessionInfo
  label: string
}

export function useTablesLiveState({
  restaurantId,
  initialOpenSessions,
  initialSessionError,
  setTables,
}: UseTablesLiveStateOptions) {
  const [openSessions, setOpenSessions] = useState<Record<string, OpenSessionInfo>>(
    () => sessionsByTable(initialOpenSessions),
  )
  const [sessionError, setSessionError] = useState<string | null>(initialSessionError)
  const [settlementTarget, setSettlementTarget] = useState<SettlementTarget | null>(null)
  const [pendingRequests, setPendingRequests] = useState<Record<string, PendingTableRequestView[]>>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const sessionLoadSeq = useRef(0)
  const requestLoadSeq = useRef(0)

  const refreshSessions = useCallback(async () => {
    const seq = ++sessionLoadSeq.current
    const result = await getOpenTableSessions(restaurantId)
    if (seq !== sessionLoadSeq.current) return
    if (!Array.isArray(result)) {
      setSessionError(result.error)
      return
    }

    const nextSessions = sessionsByTable(result)
    setSessionError(null)
    setOpenSessions(nextSessions)
    setTables((current) => applySessionsToTables(current, nextSessions))
  }, [restaurantId, setTables])

  const refreshPendingRequests = useCallback(async () => {
    const seq = ++requestLoadSeq.current
    const result = await getPendingServiceRequests(restaurantId)
    if (seq !== requestLoadSeq.current) return
    if (!Array.isArray(result)) {
      setRequestError(result.error)
      return
    }

    setRequestError(null)
    setPendingRequests(requestsByTable(result))
  }, [restaurantId])

  useEffect(() => { void refreshSessions() }, [refreshSessions])
  useEffect(() => { void refreshPendingRequests() }, [refreshPendingRequests])

  // Realtime payloads are invalidation signals only. Access-gated actions
  // rebuild the authoritative aggregates; partial payloads never alter totals.
  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    let refreshTimer: number | null = null
    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        void refreshSessions()
      }, 180)
    }
    const channel = supabase
      .channel(`tables-sessions:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_sessions', filter: `restaurant_id=eq.${restaurantId}` },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_shares', filter: `restaurant_id=eq.${restaurantId}` },
        scheduleRefresh,
      )
      .subscribe()

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [restaurantId, refreshSessions])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    const channel = supabase
      .channel(`tables-service-requests:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `restaurant_id=eq.${restaurantId}` },
        () => { void refreshPendingRequests() },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [restaurantId, refreshPendingRequests])

  const resolveRequest = useCallback(async (requestId: string) => {
    setRequestError(null)
    const result = await resolveServiceRequest(requestId, restaurantId)
    if ('error' in result) {
      setRequestError(result.error)
      void refreshPendingRequests()
      return
    }

    setPendingRequests((current) => removePendingRequest(current, requestId))
    void refreshPendingRequests()
  }, [restaurantId, refreshPendingRequests])

  const requestSessionClose = useCallback(async (session: OpenSessionInfo, label: string) => {
    // Money remaining on the adisyon must enter the settlement flow. A fully
    // paid session can close directly through the same server-side guard.
    if (sessionRequiresSettlement(session)) {
      setSettlementTarget({ session, label })
      return
    }

    const result = await closeTableSession(session.sessionId, restaurantId)
    if ('error' in result) {
      setSessionError(result.error)
      return
    }
    void refreshSessions()
  }, [restaurantId, refreshSessions])

  return {
    openSessions,
    sessionError,
    reportSessionError: setSessionError,
    refreshSessions,
    settlementTarget,
    dismissSettlement: () => setSettlementTarget(null),
    requestSessionClose,
    pendingRequests,
    requestError,
    resolveRequest,
  }
}
